// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {DLCAccount} from "../src/DLCAccount.sol";
import {ILatch} from "../src/interfaces/ILatch.sol";

contract DLCAccountHarness is DLCAccount {
    constructor(
        address alice_,
        address bob_,
        ILatch latch_,
        bytes32 eventId_,
        uint256 payoutA_,
        uint256 payoutB_,
        uint256 gasBuffer_,
        address stakingRegistry_
    ) DLCAccount(alice_, bob_, latch_, eventId_, payoutA_, payoutB_, gasBuffer_, stakingRegistry_) {}

    function verify(
        address signer0,
        address signer1,
        uint256 msg0,
        uint256 msg1,
        uint8 latchState,
        uint256 balance,
        address latch_,
        bytes32 eventId_,
        uint8 expectedTag
    ) external view {
        _verify(signer0, signer1, msg0, msg1, latchState, balance, latch_, eventId_, expectedTag);
    }
}
