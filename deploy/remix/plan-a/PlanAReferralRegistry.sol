// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {PlanACommissionVault} from "./CommissionVault.sol";

/// @notice One-level referral attribution with a separately funded commission budget.
/// @dev Registration deposits are forwarded to registrationVault and can never be
///      used by this contract to pay commissions. No Reborn, matrix, or guaranteed return.
contract PlanAReferralRegistry is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable asset;
    address public immutable registrationVault;
    PlanACommissionVault public immutable commissionVault;
    uint256 public immutable registrationAmount;
    uint256 public immutable commissionPerReferral;
    uint256 public immutable maxCommissionsPerReferrer;

    uint256 public nextTicketId = 1;
    uint256 public totalRegistered;
    uint256 public totalCommissionPaid;
    mapping(address => bool) public registered;
    mapping(address => address) public referrerOf;
    mapping(address => uint256) public referralCount;
    mapping(bytes32 => address) public referrerForCode;
    mapping(address => uint256) public commissionsPaidCount;

    error InvalidAddress();
    error InvalidAmount();
    error AlreadyRegistered();
    error InvalidReferrer();
    error InvalidCode();
    error CodeDisabled();
    error CommissionLimitReached();

    event ReferralCodeConfigured(bytes32 indexed code, address indexed referrer, bool enabled);
    event Registered(uint256 indexed ticketId, address indexed user, address indexed referrer, uint256 amount);
    event CommissionTriggered(uint256 indexed ticketId, address indexed referrer, address indexed user, uint256 amount);

    constructor(
        IERC20 asset_,
        address registrationVault_,
        PlanACommissionVault commissionVault_,
        uint256 registrationAmount_,
        uint256 commissionPerReferral_,
        uint256 maxCommissionsPerReferrer_,
        address initialOwner
    ) Ownable(initialOwner) {
        if (address(asset_) == address(0) || registrationVault_ == address(0) || address(commissionVault_) == address(0) || initialOwner == address(0)) revert InvalidAddress();
        if (registrationAmount_ == 0 || commissionPerReferral_ == 0 || maxCommissionsPerReferrer_ == 0) revert InvalidAmount();
        asset = asset_;
        registrationVault = registrationVault_;
        commissionVault = commissionVault_;
        registrationAmount = registrationAmount_;
        commissionPerReferral = commissionPerReferral_;
        maxCommissionsPerReferrer = maxCommissionsPerReferrer_;
    }

    function setReferralCode(bytes32 code, address referrer, bool enabled) external onlyOwner {
        if (code == bytes32(0) || referrer == address(0)) revert InvalidCode();
        if (enabled) referrerForCode[code] = referrer;
        else delete referrerForCode[code];
        emit ReferralCodeConfigured(code, referrer, enabled);
    }

    function registerWithReferralCode(bytes32 code) external nonReentrant returns (uint256 ticketId) {
        address referrer = referrerForCode[code];
        if (code == bytes32(0)) revert InvalidCode();
        if (referrer == address(0)) revert CodeDisabled();
        return _register(referrer);
    }

    function registerWithReferral(address referrer) external nonReentrant returns (uint256 ticketId) {
        return _register(referrer);
    }

    function _register(address referrer) internal returns (uint256 ticketId) {
        address user = msg.sender;
        if (registered[user]) revert AlreadyRegistered();
        if (referrer == address(0) || referrer == user || referrer == address(this)) revert InvalidReferrer();

        // Registration money goes directly to the registration vault.
        asset.safeTransferFrom(user, registrationVault, registrationAmount);

        registered[user] = true;
        referrerOf[user] = referrer;
        referralCount[referrer] += 1;

        ticketId = nextTicketId++;
        totalRegistered += 1;
        emit Registered(ticketId, user, referrer, registrationAmount);

        // Commission is paid only from the separately pre-funded CommissionVault.
        if (commissionsPaidCount[referrer] >= maxCommissionsPerReferrer) revert CommissionLimitReached();
        commissionVault.payCommission(referrer, user, ticketId, commissionPerReferral);
        commissionsPaidCount[referrer] += 1;
        totalCommissionPaid += commissionPerReferral;
        emit CommissionTriggered(ticketId, referrer, user, commissionPerReferral);
    }
}
