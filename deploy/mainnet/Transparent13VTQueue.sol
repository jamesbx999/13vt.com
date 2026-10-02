// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Transparent13VTQueue
/// @notice Testnet-oriented, externally funded FIFO allocation with pull claims.
/// @dev This contract intentionally has no referral tree, automatic reborn, minting,
///      guaranteed return, owner sweep, or hidden payout routing.
contract Transparent13VTQueue is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Address for address payable;

    uint256 public constant SERVICE_FEE_WEI = 0.0013 ether;
    uint256 public constant MAX_FUND_TICKETS = 50;

    IERC20 public immutable asset;
    address payable public immutable feeWallet;
    uint8 public immutable assetDecimals;
    uint256 public immutable depositAmount;
    uint256 public nextTicketId = 1;
    uint256 public nextUnfundedTicketId = 1;
    uint256 public totalScheduled;
    uint256 public totalClaimed;
    uint256 public totalReborn;
    mapping(uint256 => uint256) public rebornOf;

    struct Ticket {
        address recipient;
        uint256 amount;
        bool claimed;
    }

    mapping(uint256 => Ticket) public tickets;

    error InvalidAsset();
    error InvalidAssetDecimals();
    error InvalidFeeWallet();
    error InvalidServiceFee();
    error InvalidRecipient();
    error InvalidAmount();
    error InvalidCount();
    error BatchTooLarge();
    error AlreadyRegistered();
    error NotRegistered();
    error NotRecipient();
    error AlreadyClaimed();
    error TicketNotFunded();
    error NoFundedTicket();
    error TransferAmountMismatch();
    error FeeTransferFailed();
    error RebornNotEligible();
    error RebornAlreadyCreated();

    event Registered(
        uint256 indexed ticketId,
        address indexed payer,
        address indexed recipient,
        uint256 tokenAmount,
        uint256 serviceFeeWei
    );
    event RevenueScheduled(
        uint256 indexed firstTicketId,
        uint256 indexed lastTicketId,
        uint256 amount,
        uint256 amountPerTicket,
        address indexed funder
    );
    event Claimed(uint256 indexed ticketId, address indexed recipient, uint256 amount);
    event Reborn(uint256 indexed parentId, uint256 indexed successorId, address indexed recipient);

    constructor(IERC20 asset_, address payable feeWallet_) {
        if (address(asset_) == address(0) || address(asset_).code.length == 0) revert InvalidAsset();
        if (feeWallet_ == address(0)) revert InvalidFeeWallet();
        uint8 decimals = IERC20Metadata(address(asset_)).decimals();
        if (decimals > 18) revert InvalidAssetDecimals();
        asset = asset_;
        feeWallet = feeWallet_;
        assetDecimals = decimals;
        depositAmount = 13 * (10 ** decimals);
    }

    /// @notice Create one FIFO ticket. The token allowance must be set separately.
    ///         The BNB service fee is collected exactly once here.
    function registerPosition(address recipient)
        external
        payable
        nonReentrant
        returns (uint256 ticketId)
    {
        if (msg.value != SERVICE_FEE_WEI) revert InvalidServiceFee();
        if (recipient == address(0)) revert InvalidRecipient();

        uint256 beforeBalance = asset.balanceOf(address(this));
        asset.safeTransferFrom(msg.sender, address(this), depositAmount);
        if (asset.balanceOf(address(this)) - beforeBalance != depositAmount) {
            revert TransferAmountMismatch();
        }

        feeWallet.sendValue(msg.value);

        ticketId = nextTicketId++;
        tickets[ticketId] = Ticket({recipient: recipient, amount: 0, claimed: false});
        emit Registered(ticketId, msg.sender, recipient, depositAmount, msg.value);
    }

    /// @notice Deposit external revenue and allocate it FIFO across waiting tickets.
    ///         This is deliberately explicit; no member deposit is silently reused.
    function fundNext(uint256 amount, uint256 recipientCount)
        external
        nonReentrant
        returns (uint256 firstTicketId, uint256 lastTicketId, uint256 amountPerTicket)
    {
        if (recipientCount == 0) revert InvalidCount();
        if (recipientCount > MAX_FUND_TICKETS) revert BatchTooLarge();
        if (amount == 0 || amount % recipientCount != 0) revert InvalidAmount();
        firstTicketId = nextUnfundedTicketId;
        lastTicketId = firstTicketId + recipientCount - 1;
        if (lastTicketId >= nextTicketId) revert NoFundedTicket();
        amountPerTicket = amount / recipientCount;
        if (amountPerTicket == 0) revert InvalidAmount();

        uint256 beforeBalance = asset.balanceOf(address(this));
        asset.safeTransferFrom(msg.sender, address(this), amount);
        if (asset.balanceOf(address(this)) - beforeBalance != amount) {
            revert TransferAmountMismatch();
        }

        for (uint256 id = firstTicketId; id <= lastTicketId; ++id) {
            Ticket storage ticket = tickets[id];
            if (ticket.recipient == address(0) || ticket.amount != 0 || ticket.claimed) {
                revert NoFundedTicket();
            }
            ticket.amount = amountPerTicket;
        }
        nextUnfundedTicketId = lastTicketId + 1;
        totalScheduled += amount;
        emit RevenueScheduled(firstTicketId, lastTicketId, amount, amountPerTicket, msg.sender);
    }

    /// @notice Recipient pulls an allocated amount; state is committed before token transfer.
    function claim(uint256 ticketId) external nonReentrant {
        Ticket storage ticket = tickets[ticketId];
        if (ticket.recipient == address(0)) revert NotRegistered();
        if (ticket.recipient != msg.sender) revert NotRecipient();
        if (ticket.claimed) revert AlreadyClaimed();
        if (ticket.amount == 0) revert TicketNotFunded();

        uint256 amount = ticket.amount;
        ticket.claimed = true;
        ticket.amount = 0;
        totalClaimed += amount;
        asset.safeTransfer(msg.sender, amount);
        emit Claimed(ticketId, msg.sender, amount);
    }

    /// @notice Explicit, unfunded successor for a claimed ticket. No token or BNB is created.
    ///         This event is evidence of a new Position only; it is not a payout or guarantee.
    function createRebornPosition(uint256 parentId)
        external
        nonReentrant
        returns (uint256 successorId)
    {
        Ticket storage parent = tickets[parentId];
        if (parent.recipient == address(0) || !parent.claimed) revert RebornNotEligible();
        if (rebornOf[parentId] != 0) revert RebornAlreadyCreated();
        rebornOf[parentId] = successorId = nextTicketId++;
        totalReborn += 1;
        tickets[successorId] = Ticket({recipient: parent.recipient, amount: 0, claimed: false});
        emit Reborn(parentId, successorId, parent.recipient);
    }

    function queueState()
        external
        view
        returns (uint256 registered, uint256 waiting, uint256 scheduled, uint256 claimed, uint256 balance)
    {
        registered = nextTicketId - 1;
        waiting = registered >= nextUnfundedTicketId
            ? registered - nextUnfundedTicketId + 1
            : 0;
        scheduled = totalScheduled;
        claimed = totalClaimed;
        balance = asset.balanceOf(address(this));
    }
}
