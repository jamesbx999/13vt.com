// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
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
    uint256 public constant DEPOSIT_AMOUNT = 13 ether; // Configure only for an 18-decimal test token.

    IERC20 public immutable asset;
    address payable public immutable feeWallet;
    uint256 public nextTicketId = 1;
    uint256 public nextUnfundedTicketId = 1;
    uint256 public totalScheduled;
    uint256 public totalClaimed;

    struct Ticket {
        address recipient;
        uint256 amount;
        bool claimed;
    }

    mapping(uint256 => Ticket) public tickets;

    error InvalidAsset();
    error InvalidFeeWallet();
    error InvalidServiceFee();
    error InvalidRecipient();
    error InvalidAmount();
    error InvalidCount();
    error AlreadyRegistered();
    error NotRegistered();
    error NotRecipient();
    error AlreadyClaimed();
    error TicketNotFunded();
    error NoFundedTicket();
    error TransferAmountMismatch();
    error FeeTransferFailed();

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

    constructor(IERC20 asset_, address payable feeWallet_) {
        if (address(asset_) == address(0)) revert InvalidAsset();
        if (feeWallet_ == address(0)) revert InvalidFeeWallet();
        asset = asset_;
        feeWallet = feeWallet_;
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
        asset.safeTransferFrom(msg.sender, address(this), DEPOSIT_AMOUNT);
        if (asset.balanceOf(address(this)) - beforeBalance != DEPOSIT_AMOUNT) {
            revert TransferAmountMismatch();
        }

        feeWallet.sendValue(msg.value);

        ticketId = nextTicketId++;
        tickets[ticketId] = Ticket({recipient: recipient, amount: 0, claimed: false});
        emit Registered(ticketId, msg.sender, recipient, DEPOSIT_AMOUNT, msg.value);
    }

    /// @notice Deposit external revenue and allocate it FIFO across waiting tickets.
    ///         This is deliberately explicit; no member deposit is silently reused.
    function fundNext(uint256 amount, uint256 recipientCount)
        external
        nonReentrant
        returns (uint256 firstTicketId, uint256 lastTicketId, uint256 amountPerTicket)
    {
        if (recipientCount == 0) revert InvalidCount();
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
