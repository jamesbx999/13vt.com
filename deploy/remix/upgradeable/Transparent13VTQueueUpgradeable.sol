// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

/// @title Transparent13VTQueueUpgradeable
/// @notice UUPS-upgradeable, externally funded FIFO allocation with pull claims.
/// @dev Deploy behind an ERC1967Proxy. The existing non-proxy queue cannot be upgraded.
contract Transparent13VTQueueUpgradeable is Initializable, OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;
    using Address for address payable;

    address public constant DESIGNATED_INITIAL_OWNER = 0x11B948575B648be50Eef781251ebdc876907E618;
    uint256 public constant MAX_ALLOWED_FUND_TICKETS = 200;

    IERC20 public asset;
    address payable public feeWallet;
    uint8 public assetDecimals;
    uint256 public depositAmount;
    uint256 public serviceFeeWei;
    uint256 public maxFundTickets;
    uint256 public nextTicketId = 1;
    uint256 public nextUnfundedTicketId = 1;
    uint256 public totalScheduled;
    uint256 public totalClaimed;
    uint256 public totalReborn;
    mapping(uint256 => uint256) public rebornOf;

    struct Ticket { address recipient; uint256 amount; bool claimed; }
    mapping(uint256 => Ticket) public tickets;

    error InvalidAsset();
    error InvalidAssetDecimals();
    error InvalidFeeWallet();
    error InvalidOwner();
    error InvalidServiceFee();
    error InvalidRecipient();
    error InvalidAmount();
    error InvalidCount();
    error BatchTooLarge();
    error NotRegistered();
    error NotRecipient();
    error AlreadyClaimed();
    error TicketNotFunded();
    error NoFundedTicket();
    error TransferAmountMismatch();
    error RebornNotEligible();
    error RebornAlreadyCreated();

    event InitializedConfig(address indexed asset, uint8 assetDecimals, uint256 depositAmount, uint256 serviceFeeWei, uint256 maxFundTickets, address indexed feeWallet, address indexed owner);
    event ServiceFeeUpdated(uint256 oldValue, uint256 newValue);
    event DepositAmountUpdated(uint256 oldValue, uint256 newValue);
    event MaxFundTicketsUpdated(uint256 oldValue, uint256 newValue);
    event FeeWalletUpdated(address indexed oldWallet, address indexed newWallet);
    event Registered(uint256 indexed ticketId, address indexed payer, address indexed recipient, uint256 tokenAmount, uint256 serviceFeeWei);
    event RevenueScheduled(uint256 indexed firstTicketId, uint256 indexed lastTicketId, uint256 amount, uint256 amountPerTicket, address indexed funder);
    event Claimed(uint256 indexed ticketId, address indexed recipient, uint256 amount);
    event Reborn(uint256 indexed parentId, uint256 indexed successorId, address indexed recipient);

    constructor() { _disableInitializers(); }

    function initialize(IERC20 asset_, address payable feeWallet_, address initialOwner) external initializer {
        if (address(asset_) == address(0) || address(asset_).code.length == 0) revert InvalidAsset();
        if (feeWallet_ == address(0)) revert InvalidFeeWallet();
        if (initialOwner != DESIGNATED_INITIAL_OWNER) revert InvalidOwner();
        uint8 decimals = IERC20Metadata(address(asset_)).decimals();
        if (decimals > 18) revert InvalidAssetDecimals();

        __Ownable_init(initialOwner);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        asset = asset_;
        feeWallet = feeWallet_;
        assetDecimals = decimals;
        depositAmount = 13 * (10 ** decimals);
        serviceFeeWei = 0.0013 ether;
        maxFundTickets = 50;
        // Proxy storage does not receive implementation state-variable initializers.
        nextTicketId = 1;
        nextUnfundedTicketId = 1;
        emit InitializedConfig(address(asset_), decimals, depositAmount, serviceFeeWei, maxFundTickets, feeWallet_, initialOwner);
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function setServiceFeeWei(uint256 newValue) external onlyOwner {
        if (newValue > 0.01 ether) revert InvalidServiceFee();
        emit ServiceFeeUpdated(serviceFeeWei, newValue);
        serviceFeeWei = newValue;
    }

    function setDepositAmount(uint256 newValue) external onlyOwner {
        if (newValue == 0) revert InvalidAmount();
        emit DepositAmountUpdated(depositAmount, newValue);
        depositAmount = newValue;
    }

    function setMaxFundTickets(uint256 newValue) external onlyOwner {
        if (newValue == 0 || newValue > MAX_ALLOWED_FUND_TICKETS) revert BatchTooLarge();
        emit MaxFundTicketsUpdated(maxFundTickets, newValue);
        maxFundTickets = newValue;
    }

    function setFeeWallet(address payable newWallet) external onlyOwner {
        if (newWallet == address(0)) revert InvalidFeeWallet();
        emit FeeWalletUpdated(feeWallet, newWallet);
        feeWallet = newWallet;
    }

    function registerPosition(address recipient) external payable nonReentrant returns (uint256 ticketId) {
        if (msg.value != serviceFeeWei) revert InvalidServiceFee();
        if (recipient == address(0)) revert InvalidRecipient();
        uint256 beforeBalance = asset.balanceOf(address(this));
        asset.safeTransferFrom(msg.sender, address(this), depositAmount);
        if (asset.balanceOf(address(this)) - beforeBalance != depositAmount) revert TransferAmountMismatch();
        feeWallet.sendValue(msg.value);
        ticketId = nextTicketId++;
        tickets[ticketId] = Ticket({recipient: recipient, amount: 0, claimed: false});
        emit Registered(ticketId, msg.sender, recipient, depositAmount, msg.value);
    }

    function fundNext(uint256 amount, uint256 recipientCount) external nonReentrant returns (uint256 firstTicketId, uint256 lastTicketId, uint256 amountPerTicket) {
        if (recipientCount == 0) revert InvalidCount();
        if (recipientCount > maxFundTickets) revert BatchTooLarge();
        if (amount == 0 || amount % recipientCount != 0) revert InvalidAmount();
        firstTicketId = nextUnfundedTicketId;
        lastTicketId = firstTicketId + recipientCount - 1;
        if (lastTicketId >= nextTicketId) revert NoFundedTicket();
        amountPerTicket = amount / recipientCount;
        if (amountPerTicket == 0) revert InvalidAmount();
        uint256 beforeBalance = asset.balanceOf(address(this));
        asset.safeTransferFrom(msg.sender, address(this), amount);
        if (asset.balanceOf(address(this)) - beforeBalance != amount) revert TransferAmountMismatch();
        for (uint256 id = firstTicketId; id <= lastTicketId; ++id) {
            Ticket storage ticket = tickets[id];
            if (ticket.recipient == address(0) || ticket.amount != 0 || ticket.claimed) revert NoFundedTicket();
            ticket.amount = amountPerTicket;
        }
        nextUnfundedTicketId = lastTicketId + 1;
        totalScheduled += amount;
        emit RevenueScheduled(firstTicketId, lastTicketId, amount, amountPerTicket, msg.sender);
    }

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

    function createRebornPosition(uint256 parentId) external nonReentrant returns (uint256 successorId) {
        Ticket storage parent = tickets[parentId];
        if (parent.recipient == address(0) || !parent.claimed) revert RebornNotEligible();
        if (rebornOf[parentId] != 0) revert RebornAlreadyCreated();
        rebornOf[parentId] = successorId = nextTicketId++;
        totalReborn += 1;
        tickets[successorId] = Ticket({recipient: parent.recipient, amount: 0, claimed: false});
        emit Reborn(parentId, successorId, parent.recipient);
    }

    function queueState() external view returns (uint256 registered, uint256 waiting, uint256 scheduled, uint256 claimed, uint256 balance) {
        registered = nextTicketId - 1;
        waiting = registered >= nextUnfundedTicketId ? registered - nextUnfundedTicketId + 1 : 0;
        scheduled = totalScheduled;
        claimed = totalClaimed;
        balance = asset.balanceOf(address(this));
    }

    // Reserve storage slots for reviewed future implementations.
    uint256[40] private __gap;
}
