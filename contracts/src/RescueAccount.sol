// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {HegotaSupport} from "@forshtat/hegota-support/contracts/HegotaSupport.sol";
import {Devnet} from "@forshtat/hegota-support/contracts/Devnet.sol";
import {Scope, SigParam} from "@forshtat/hegota-support/contracts/Params.sol";
import {ILatch} from "./interfaces/ILatch.sol";
import {IStakingRegistry} from "./interfaces/IStakingRegistry.sol";

/// A pre-committed rescue account. The owner's signature is checked by the protocol; the VERIFY frame
/// only has to confirm that the resolved signer is the owner, that the shared latch is EXPIRED, and
/// that the account still has room for the rescue plus gas.
///
/// The account is staked: the alt-mempool admits its foreign latch read; the canonical mempool does not.
contract RescueAccount is HegotaSupport(Devnet.ERC8421_WORKSHOP) {
    address public immutable owner;
    address public immutable beneficiary;
    ILatch public immutable latch;
    bytes32 public immutable eventId;
    uint256 public immutable rescueAmount;
    uint256 public immutable gasBuffer;
    address public immutable stakingRegistry;

    error BadTrigger();
    error NotExpired();
    error BadSigner();
    error NoRoom();

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(
        address owner_,
        address beneficiary_,
        ILatch latch_,
        bytes32 eventId_,
        uint256 rescueAmount_,
        uint256 gasBuffer_,
        address stakingRegistry_
    ) payable {
        require(owner_ != address(0), "owner");
        require(beneficiary_ != address(0), "beneficiary");
        require(address(latch_) != address(0), "latch");
        require(gasBuffer_ > 0, "buffer");
        owner = owner_;
        beneficiary = beneficiary_;
        latch = latch_;
        eventId = eventId_;
        rescueAmount = rescueAmount_;
        gasBuffer = gasBuffer_;
        stakingRegistry = stakingRegistry_;
    }

    receive() external payable {}

    /// The VERIFY frame whose target is this account. The frame data is the signed trigger
    /// `(latch, eventId, expectedTag)`; the protocol has already verified the owner's signature.
    fallback() external payable {
        (address latch_, bytes32 eventId_, uint8 expectedTag) = abi.decode(msg.data, (address, bytes32, uint8));
        _verify(
            address(uint160(sigparam(0, SigParam.RESOLVED_SIGNER))),
            sigparam(0, SigParam.MSG),
            uint8(latch.state(eventId)),
            address(this).balance,
            latch_,
            eventId_,
            expectedTag
        );
        approve(Scope.EXECUTION_AND_PAYMENT);
    }

    function _verify(
        address signer,
        uint256 msg0,
        uint8 latchState,
        uint256 balance,
        address latch_,
        bytes32 eventId_,
        uint8 expectedTag
    ) internal view {
        if (msg0 != 0) revert BadSigner();
        if (expectedTag != uint8(ILatch.State.EXPIRED)) revert BadTrigger();
        if (latch_ != address(latch) || eventId_ != eventId) revert BadTrigger();
        if (latchState != expectedTag) revert NotExpired();
        if (signer != owner) revert BadSigner();
        if (balance < rescueAmount + gasBuffer) revert NoRoom();
    }

    function stake(uint32 delay) external payable onlyOwner {
        IStakingRegistry(stakingRegistry).addStake{value: msg.value}(delay);
    }

    function withdraw() external onlyOwner {
        require(latch.state(eventId) == ILatch.State.UNSET, "settled");
        (bool ok,) = owner.call{value: address(this).balance}("");
        require(ok, "withdraw");
    }
}
