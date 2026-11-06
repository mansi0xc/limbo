// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface ILatch {
    enum State {
        UNSET,
        YES,
        NO,
        EXPIRED
    }

    event Opened(bytes32 indexed eventId, uint64 deadline);
    event Pinged(bytes32 indexed eventId, uint64 deadline);
    event Attested(bytes32 indexed eventId, State state);
    event Expired(bytes32 indexed eventId);

    function state(bytes32 eventId) external view returns (State);
    function deadline(bytes32 eventId) external view returns (uint64);
    function open(bytes32 eventId, uint64 deadline_) external;
    function ping(bytes32 eventId) external;
    function attest(bytes32 eventId, bool yes) external;
    function expire(bytes32 eventId) external;
}
