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

/// @title Transparent13VTQueueUpgradeableReferralV4AutoPush
/// @notice UUPS FIFO queue with on-chain referral metadata and explicit auto-push
///         settlement: fundNext allocates and pays each funded ticket atomically.
/// @dev Storage order before __gap must remain identical to the deployed V1.
contract Transparent13VTQueueUpgradeableReferralV4AutoPush is Initializable, OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;
    using Address for address payable;

    address public constant DESIGNATED_INITIAL_OWNER = 0x11B948575B648be50Eef781251ebdc876907E618;
    uint256 public constant MAX_ALLOWED_FUND_TICKETS = 200;

    // V1 storage: do not reorder or change these declarations.
    IERC20 public asset;
    address payable public feeWallet;
    uint8 public assetDecimals;
    uint256 public depositAmount;
    uint256 public serviceFeeWei;
    uint256 public maxFundTickets;
    uint256 public nextTicketId;
    uint256 public nextUnfundedTicketId;
    uint256 public totalScheduled;
    uint256 public totalClaimed;
    uint256 public totalReborn;
    mapping(uint256 => uint256) public rebornOf;

    struct Ticket { address recipient; uint256 amount; bool claimed; }
    mapping(uint256 => Ticket) public tickets;

    // V2 additions consume two slots previously reserved by V1's __gap.
    mapping(bytes32 => address) private _referrerForCode;
    mapping(address => address) private _referrerOf;

    // V3 addition consumes one more slot from the inherited gap.
    // This is a cumulative registration inflow reserve, not a claimable balance.
    uint256 public totalUserDeposits;
    bool public accountingInitialized;

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
    error InvalidReferralCode();
    error ReferralCodeDisabled();
    error ReferralAlreadyBound();
    error InvalidReferrer();
    error InvalidToken();
    error InsufficientSurplus(uint256 available, uint256 requested);
    error AccountingAlreadyInitialized();
    error AccountingBelowClaimed();

    event InitializedConfig(address indexed asset, uint8 assetDecimals, uint256 depositAmount, uint256 serviceFeeWei, uint256 maxFundTickets, address indexed feeWallet, address indexed owner);
    event ServiceFeeUpdated(uint256 oldValue, uint256 newValue);
    event DepositAmountUpdated(uint256 oldValue, uint256 newValue);
    event MaxFundTicketsUpdated(uint256 oldValue, uint256 newValue);
    event FeeWalletUpdated(address indexed oldWallet, address indexed newWallet);
    event Registered(uint256 indexed ticketId, address indexed payer, address indexed recipient, uint256 tokenAmount, uint256 serviceFeeWei);
    event RevenueScheduled(uint256 indexed firstTicketId, uint256 indexed lastTicketId, uint256 amount, uint256 amountPerTicket, address indexed funder);
    event Claimed(uint256 indexed ticketId, address indexed recipient, uint256 amount);
    event Reborn(uint256 indexed parentId, uint256 indexed successorId, address indexed recipient);
    event ReferralCodeConfigured(bytes32 indexed code, address indexed referrer, bool enabled);
    event ReferralRegistered(bytes32 indexed code, address indexed user, address indexed referrer, uint256 ticketId);
    event ForeignTokenRescued(address indexed token, address indexed to, uint256 amount);
    event SurplusWithdrawn(address indexed to, uint256 amount, uint256 remainingSurplus);
    event AccountingInitialized(uint256 historicalUserDeposits, uint256 reserved, address indexed initializer);
    event AutoPaid(uint256 indexed ticketId, address indexed recipient, uint256 amount, address indexed funder);

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

    function setReferralCode(bytes32 code, address referrer, bool enabled) external onlyOwner {
        if (code == bytes32(0) || referrer == address(0) || referrer == address(this)) revert InvalidReferralCode();
        if (enabled) {
            _referrerForCode[code] = referrer;
        } else {
            delete _referrerForCode[code];
        }
        emit ReferralCodeConfigured(code, referrer, enabled);
    }

    function referrerForCode(bytes32 code) external view returns (address) {
        return _referrerForCode[code];
    }

    function referrerOf(address user) external view returns (address) {
        return _referrerOf[user];
    }

    function registerPosition(address recipient) external payable nonReentrant returns (uint256 ticketId) {
        ticketId = _registerPosition(msg.sender, recipient);
    }

    function registerWithReferralCode(bytes32 code) external payable nonReentrant returns (uint256 ticketId) {
        address referrer = _referrerForCode[code];
        if (code == bytes32(0)) revert InvalidReferralCode();
        if (referrer == address(0)) revert ReferralCodeDisabled();
        ticketId = _registerWithReferrer(msg.sender, referrer);
        emit ReferralRegistered(code, msg.sender, referrer, ticketId);
    }

    function registerWithReferral(address referrer) external payable nonReentrant returns (uint256 ticketId) {
        ticketId = _registerWithReferrer(msg.sender, referrer);
        emit ReferralRegistered(bytes32(0), msg.sender, referrer, ticketId);
    }

    function _registerWithReferrer(address user, address referrer) internal returns (uint256 ticketId) {
        if (referrer == address(0) || referrer == user || referrer == address(this)) revert InvalidReferrer();
        if (_referrerOf[user] != address(0)) revert ReferralAlreadyBound();
        _referrerOf[user] = referrer;
        ticketId = _registerPosition(user, user);
    }

    function _registerPosition(address payer, address recipient) internal returns (uint256 ticketId) {
        if (msg.value != serviceFeeWei) revert InvalidServiceFee();
        if (recipient == address(0)) revert InvalidRecipient();
        uint256 beforeBalance = asset.balanceOf(address(this));
        asset.safeTransferFrom(payer, address(this), depositAmount);
        if (asset.balanceOf(address(this)) - beforeBalance != depositAmount) revert TransferAmountMismatch();
        totalUserDeposits += depositAmount;
        feeWallet.sendValue(msg.value);
        ticketId = nextTicketId++;
        tickets[ticketId] = Ticket({recipient: recipient, amount: 0, claimed: false});
        emit Registered(ticketId, payer, recipient, depositAmount, msg.value);
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

        // Push settlement is atomic with funding. If any token transfer fails,
        // the complete fundNext transaction reverts and no ticket is marked paid.
        for (uint256 id = firstTicketId; id <= lastTicketId; ++id) {
            _autoPay(id, msg.sender);
        }
    }

    function _autoPay(uint256 ticketId, address funder) internal {
        Ticket storage ticket = tickets[ticketId];
        uint256 amount = ticket.amount;
        address recipient = ticket.recipient;
        ticket.claimed = true;
        ticket.amount = 0;
        totalClaimed += amount;
        asset.safeTransfer(recipient, amount);
        emit Claimed(ticketId, recipient, amount);
        emit AutoPaid(ticketId, recipient, amount, funder);
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


    /// @notice Sum of amounts allocated to tickets that are not claimed yet.
    /// @dev Equivalent to totalScheduled - totalClaimed under the queue invariant.
    function totalFundedUnclaimed() public view returns (uint256) {
        return totalScheduled - totalClaimed;
    }

    /// @notice Current aggregate amount claimable by recipients.
    function totalClaimable() public view returns (uint256) {
        return totalFundedUnclaimed();
    }

    /// @notice Reserve the larger of remaining registration inflows and pending claims.
    /// @dev Prevents withdrawing either unallocated registration funds or funded claims.
    function totalReserved() public view returns (uint256) {
        if (!accountingInitialized) return type(uint256).max;
        uint256 remainingUserDeposits = totalUserDeposits > totalClaimed
            ? totalUserDeposits - totalClaimed
            : 0;
        uint256 pendingClaims = totalFundedUnclaimed();
        return remainingUserDeposits > pendingClaims ? remainingUserDeposits : pendingClaims;
    }

    /// @notice Token balance not reserved for registration inflows or pending claims.
    function surplus() public view returns (uint256) {
        if (!accountingInitialized) return 0;
        uint256 balance = asset.balanceOf(address(this));
        uint256 reserved = totalReserved();
        return balance > reserved ? balance - reserved : 0;
    }

    /// @notice Seed cumulative historical registrations after a V2 -> V3 upgrade.
    /// @dev The value must be reconstructed from Registered events before this call.
    function initializeAccounting(uint256 historicalUserDeposits) external onlyOwner {
        if (accountingInitialized) revert AccountingAlreadyInitialized();
        if (historicalUserDeposits < totalClaimed) revert AccountingBelowClaimed();
        totalUserDeposits = historicalUserDeposits;
        accountingInitialized = true;
        emit AccountingInitialized(historicalUserDeposits, totalReserved(), msg.sender);
    }

    /// @notice Recover tokens sent to the contract by mistake, except the configured asset.
    function rescueForeignToken(IERC20 token, address to, uint256 amount) external onlyOwner nonReentrant {
        if (address(token) == address(0) || address(token) == address(asset)) revert InvalidToken();
        if (to == address(0) || amount == 0) revert InvalidAmount();
        token.safeTransfer(to, amount);
        emit ForeignTokenRescued(address(token), to, amount);
    }

    /// @notice Withdraw only USDT that is provably above the conservative reserve.
    function withdrawSurplus(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0) || amount == 0) revert InvalidAmount();
        uint256 available = surplus();
        if (amount > available) revert InsufficientSurplus(available, amount);
        asset.safeTransfer(to, amount);
        emit SurplusWithdrawn(to, amount, available - amount);
    }

    function queueState() external view returns (uint256 registered, uint256 waiting, uint256 scheduled, uint256 claimed, uint256 balance) {
        registered = nextTicketId - 1;
        waiting = registered >= nextUnfundedTicketId ? registered - nextUnfundedTicketId + 1 : 0;
        scheduled = totalScheduled;
        claimed = totalClaimed;
        balance = asset.balanceOf(address(this));
    }

    uint256[36] private __gap;
}
