// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Separate, pre-funded budget for one-level referral rebates.
/// @dev This contract never receives registration deposits. It can only pay from
///      the commission budget explicitly funded through fundBudget().
contract PlanACommissionVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable asset;
    address public authorizedRegistry;
    uint256 public budgetRemaining;
    uint256 public totalFunded;
    uint256 public totalPaid;

    error InvalidAddress();
    error UnauthorizedRegistry();
    error InsufficientBudget();
    error InvalidAmount();

    event RegistryAuthorizationUpdated(address indexed oldRegistry, address indexed newRegistry);
    event CommissionBudgetFunded(address indexed funder, uint256 amount, uint256 newBudgetRemaining);
    event CommissionPaid(address indexed referrer, address indexed referredUser, uint256 indexed ticketId, uint256 amount);

    constructor(IERC20 asset_, address initialOwner) Ownable(initialOwner) {
        if (address(asset_) == address(0) || initialOwner == address(0)) revert InvalidAddress();
        asset = asset_;
    }

    function setAuthorizedRegistry(address registry) external onlyOwner {
        if (registry == address(0)) revert InvalidAddress();
        emit RegistryAuthorizationUpdated(authorizedRegistry, registry);
        authorizedRegistry = registry;
    }

    /// @notice Fund the commission budget from a separately identified treasury.
    function fundBudget(uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidAmount();
        asset.safeTransferFrom(msg.sender, address(this), amount);
        budgetRemaining += amount;
        totalFunded += amount;
        emit CommissionBudgetFunded(msg.sender, amount, budgetRemaining);
    }

    /// @notice Pay one commission only when called by the authorized registry.
    function payCommission(address referrer, address referredUser, uint256 ticketId, uint256 amount)
        external
        nonReentrant
    {
        if (msg.sender != authorizedRegistry) revert UnauthorizedRegistry();
        if (amount == 0 || amount > budgetRemaining) revert InsufficientBudget();
        budgetRemaining -= amount;
        totalPaid += amount;
        asset.safeTransfer(referrer, amount);
        emit CommissionPaid(referrer, referredUser, ticketId, amount);
    }
}
