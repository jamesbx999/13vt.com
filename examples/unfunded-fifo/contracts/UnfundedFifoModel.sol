// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title UnfundedFifoModel
 * @notice Educational, STATUS-ONLY simulation. NOT a payment contract and NOT production-ready.
 *         No token custody, token transfers, wallet signatures, deposit verification, or
 *         A-qualification verification. The operator's input is illustrative, not proof.
 *         Never expose the demo operator to the public as an authority over real balances.
 */
contract UnfundedFifoModel {
    enum Origin { QualifiedA, RebornB }
    enum PaymentState { Unfunded, FundedPending, Paid }

    struct Position {
        address owner;
        uint64 parentId;
        uint64 leftId;
        uint64 rightId;
        uint64 queueSequence;
        Origin origin;
        bytes32 illustrativeFundingRef;
        bytes32 illustrativePayoutRef;
        bool payoutConfirmed;
        bool successorEnqueued;
    }

    error NotOperator();
    error InvalidOwner();
    error UnknownPosition();
    error AlreadyPlaced();
    error SelfParent();
    error NoOpenParent();
    error NotLeftChild();
    error NotFunded();
    error PayoutAlreadyConfirmed();
    error InvalidReference();
    error DuplicateFundingReference();
    error PayoutReferenceMismatch();
    error RootAlreadySeeded();

    address public immutable operator;
    uint64 public nextId = 1;
    uint256 public head; // Index of the oldest open parent in the ONE global queue.
    uint64[] public fifo;
    mapping(uint64 => Position) public positions;
    mapping(bytes32 => bool) public illustrativeFundingRefUsed;
    bool public rootSeeded;

    event Enqueued(uint64 indexed id, address indexed owner, Origin origin, uint64 sequence);
    event Placed(uint64 indexed childId, uint64 indexed parentId, bool isLeft);
    event MockFundingRecorded(uint64 indexed id, bytes32 indexed fundingOrPayoutRef);
    event MockPayoutRecorded(uint64 indexed id, bytes32 indexed fundingOrPayoutRef);
    event Reborn(uint64 indexed parentId, uint64 indexed successorId);

    constructor() { operator = msg.sender; }

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    /// @dev Only for bootstrapping offline tests: no funds are collected or validated.
    function seedRoot(address owner, bytes32 fundingRef) external onlyOperator returns (uint64 id) {
        if (rootSeeded) revert RootAlreadySeeded();
        rootSeeded = true;
        id = _enqueue(owner, Origin.QualifiedA);
        if (fundingRef != bytes32(0)) _recordFunding(id, fundingRef);
    }

    /// @dev The caller asserts A qualification; this demo does NOT check A referral events.
    function enqueueQualifiedFromA(address owner, bytes32 fundingRef)
        external onlyOperator returns (uint64 id)
    {
        if (!rootSeeded) revert NoOpenParent();
        id = _enqueue(owner, Origin.QualifiedA);
        if (fundingRef != bytes32(0)) _recordFunding(id, fundingRef);
    }

    /// @dev In a real design this must verify actual new, unallocated token deposit first.
    function recordMockFunding(uint64 id, bytes32 fundingOrPayoutRef) external onlyOperator {
        Position storage p = _position(id);
        if (p.illustrativeFundingRef != bytes32(0)) revert InvalidReference();
        _recordFunding(id, fundingOrPayoutRef);
    }

    /**
     * @notice PLACE-AND-HOLD: place under oldest parent with an empty slot, left before right.
     *         Unfunded parent is never bypassed. Placement NEVER pays or claims anything.
     *         Qualified child (A) and reborn child (B) use the same FIFO when unplaced.
     */
    function place(uint64 childId) external onlyOperator returns (uint64 parentId, bool isLeft) {
        Position storage child = _position(childId);
        if (child.parentId != 0 || childId == fifo[0]) revert AlreadyPlaced();
        if (head >= fifo.length) revert NoOpenParent();
        parentId = fifo[head];
        if (parentId == childId) revert SelfParent();
        Position storage parent = positions[parentId];
        if (parent.leftId == 0) {
            parent.leftId = childId;
            isLeft = true;
        } else if (parent.rightId == 0) {
            parent.rightId = childId;
            // This parent is now full. The next enqueued position becomes FIFO head.
            ++head;
        } else {
            revert NoOpenParent();
        }
        child.parentId = parentId;
        emit Placed(childId, parentId, isLeft);
        _rebornIfComplete(parentId);
    }

    /**
     * @dev Operator-controlled MOCK only: require the SAME illustrative funding reference
     *      assigned to this position. This is NOT proof of a deposit or actual payout.
     */
    function recordMockPayout(uint64 id, bytes32 fundingOrPayoutRef) external onlyOperator returns (uint64 successor) {
        Position storage p = _position(id);
        if (p.leftId == 0) revert NotLeftChild();
        if (p.illustrativeFundingRef == bytes32(0)) revert NotFunded();
        if (p.payoutConfirmed) revert PayoutAlreadyConfirmed();
        if (fundingOrPayoutRef == bytes32(0)) revert InvalidReference();
        if (fundingOrPayoutRef != p.illustrativeFundingRef) revert PayoutReferenceMismatch();
        p.payoutConfirmed = true;
        p.illustrativePayoutRef = fundingOrPayoutRef;
        emit MockPayoutRecorded(id, fundingOrPayoutRef);
        successor = _rebornIfComplete(id);
    }

    function paymentState(uint64 id) external view returns (PaymentState) {
        Position storage p = _position(id);
        if (p.payoutConfirmed) return PaymentState.Paid;
        return p.illustrativeFundingRef == bytes32(0)
            ? PaymentState.Unfunded : PaymentState.FundedPending;
    }

    function nextOpenParent() external view returns (uint64) {
        return head < fifo.length ? fifo[head] : 0;
    }

    function queueLength() external view returns (uint256) { return fifo.length; }

    function _position(uint64 id) internal view returns (Position storage p) {
        if (id == 0 || id >= nextId) revert UnknownPosition();
        p = positions[id];
    }

    function _enqueue(address owner, Origin origin) internal returns (uint64 id) {
        if (owner == address(0)) revert InvalidOwner();
        id = nextId++;
        fifo.push(id);
        Position storage p = positions[id];
        p.owner = owner;
        p.queueSequence = uint64(fifo.length);
        p.origin = origin;
        emit Enqueued(id, owner, origin, p.queueSequence);
    }

    function _recordFunding(uint64 id, bytes32 fundingOrPayoutRef) internal {
        if (fundingOrPayoutRef == bytes32(0)) revert InvalidReference();
        if (illustrativeFundingRefUsed[fundingOrPayoutRef]) revert DuplicateFundingReference();
        illustrativeFundingRefUsed[fundingOrPayoutRef] = true;
        positions[id].illustrativeFundingRef = fundingOrPayoutRef;
        emit MockFundingRecorded(id, fundingOrPayoutRef);
    }

    function _rebornIfComplete(uint64 id) internal returns (uint64 successor) {
        Position storage p = positions[id];
        if (!p.payoutConfirmed || p.leftId == 0 || p.rightId == 0 || p.successorEnqueued) return 0;
        p.successorEnqueued = true;
        successor = _enqueue(p.owner, Origin.RebornB);
        // No funding reference is copied; the successor is UNFUNDED by definition here.
        emit Reborn(id, successor);
    }
}
