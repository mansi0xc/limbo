// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ILatch} from "./interfaces/ILatch.sol";

/// A write-once latch with two opening modes:
///
/// - `ping` for a heartbeat: the owner can extend the deadline while the latch is unset.
/// - `open` for a fixed deadline: the owner sets it once and cannot extend it.
///
/// The oracle may attest YES or NO before the deadline, and only on a fixed-deadline (`open`) event. A
/// heartbeat event can only end in EXPIRED: an oracle attestation there would strand anything that
/// waits for EXPIRED, such as a deadman rescue. Anyone may expire the latch after the
/// deadline plus the grace period. Every transition starts from UNSET, so the state is write-once.
contract Latch is ILatch {
    address public immutable owner;
    address public immutable oracle;
    uint64 public immutable interval;
    uint64 public immutable grace;

    mapping(bytes32 => ILatch.State) public override state;
    mapping(bytes32 => uint64) public override deadline;
    mapping(bytes32 => bool) public locked;

    error NotOwner();
    error NotOracle();
    error AlreadyOpened();
    error DeadlineInPast();
    error Locked();
    error Settled();
    error NotOpened();
    error DeadlinePassed();
    error GraceNotPassed();
    error NotFixed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyOracle() {
        if (msg.sender != oracle) revert NotOracle();
        _;
    }

    constructor(address owner_, address oracle_, uint64 interval_, uint64 grace_) {
        require(owner_ != address(0), "owner");
        require(grace_ > 0, "grace");
        owner = owner_;
        oracle = oracle_;
        interval = interval_;
        grace = grace_;
    }

    function open(bytes32 eventId, uint64 deadline_) external override onlyOwner {
        if (deadline[eventId] != 0) revert AlreadyOpened();
        if (uint256(deadline_) <= block.timestamp) revert DeadlineInPast();
        deadline[eventId] = deadline_;
        locked[eventId] = true;
        emit Opened(eventId, deadline_);
    }

    function ping(bytes32 eventId) external override onlyOwner {
        if (locked[eventId]) revert Locked();
        if (state[eventId] != ILatch.State.UNSET) revert Settled();
        if (interval == 0) revert Locked();
        uint64 next = uint64(block.timestamp) + interval;
        deadline[eventId] = next;
        emit Pinged(eventId, next);
    }

    function attest(bytes32 eventId, bool yes) external override onlyOracle {
        if (deadline[eventId] == 0) revert NotOpened();
        if (!locked[eventId]) revert NotFixed();
        if (state[eventId] != ILatch.State.UNSET) revert Settled();
        if (block.timestamp > uint256(deadline[eventId])) revert DeadlinePassed();
        ILatch.State next = yes ? ILatch.State.YES : ILatch.State.NO;
        state[eventId] = next;
        emit Attested(eventId, next);
    }

    function expire(bytes32 eventId) external override {
        if (deadline[eventId] == 0) revert NotOpened();
        if (state[eventId] != ILatch.State.UNSET) revert Settled();
        if (block.timestamp <= uint256(deadline[eventId]) + uint256(grace)) revert GraceNotPassed();
        state[eventId] = ILatch.State.EXPIRED;
        emit Expired(eventId);
    }

    function stateOf(bytes32 eventId) external view returns (ILatch.State) {
        return state[eventId];
    }

    function deadlineOf(bytes32 eventId) external view returns (uint64) {
        return deadline[eventId];
    }
}
