// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {HegotaSupport} from "@forshtat/hegota-support/contracts/HegotaSupport.sol";
import {Devnet} from "@forshtat/hegota-support/contracts/Devnet.sol";
import {Scope, SigParam} from "@forshtat/hegota-support/contracts/Params.sol";
import {ILatch} from "./interfaces/ILatch.sol";
import {IStakingRegistry} from "./interfaces/IStakingRegistry.sol";
import {FrameIntrospection} from "./lib/FrameIntrospection.sol";

/// A pre-committed rescue account. The owner's signature is checked by the protocol; the VERIFY frame
/// confirms that the resolved signer is the owner, that the shared latch is EXPIRED, that the account
/// still has room for the rescue plus gas, and, by reading the transaction's own frames, that the rescue
/// pays the beneficiary at least `rescueAmount`, sends value nowhere else, and marks itself as paid.
///
/// The owner can withdraw at any time except while a rescue is pending: once the latch is EXPIRED the
/// balance is reserved for the rescue until the rescue lands or `rescueWindow` has passed since the latch
/// deadline. The window should cover the grace period plus the cheque's expiry, so the reservation ends
/// only after every parked rescue cheque is dead.
///
/// The account is staked: the alt-mempool admits its foreign latch read; the canonical mempool does not.
contract RescueAccount is HegotaSupport(Devnet.ERC8421_WORKSHOP), FrameIntrospection {
    address public immutable owner;
    address public immutable beneficiary;
    ILatch public immutable latch;
    bytes32 public immutable eventId;
    uint256 public immutable rescueAmount;
    uint256 public immutable gasBuffer;
    address public immutable stakingRegistry;
    uint256 public immutable rescueWindow;

    bool public rescued;

    error BadTrigger();
    error NotExpired();
    error BadSigner();
    error NoRoom();
    error MissingRescueMark();
    error BadPayout();
    error RescuePending();

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
        address stakingRegistry_,
        uint256 rescueWindow_
    ) payable {
        require(owner_ != address(0), "owner");
        require(beneficiary_ != address(0), "beneficiary");
        require(address(latch_) != address(0), "latch");
        require(gasBuffer_ > 0, "buffer");
        require(rescueWindow_ > 0, "window");
        owner = owner_;
        beneficiary = beneficiary_;
        latch = latch_;
        eventId = eventId_;
        rescueAmount = rescueAmount_;
        gasBuffer = gasBuffer_;
        stakingRegistry = stakingRegistry_;
        rescueWindow = rescueWindow_;
    }

    receive() external payable {}

    /// The VERIFY frame whose target is this account. The frame data is the signed trigger
    /// `(latch, eventId, expectedTag)`; the protocol has already verified the owner's signature.
    fallback() external payable {
        (address latch_, bytes32 eventId_, uint8 expectedTag) = abi.decode(msg.data, (address, bytes32, uint8));
        SenderFrames memory frames = _senderFrames(this.markRescued.selector, beneficiary);
        _verify(
            address(uint160(sigparam(0, SigParam.RESOLVED_SIGNER))),
            sigparam(0, SigParam.MSG),
            uint8(latch.state(eventId)),
            address(this).balance,
            latch_,
            eventId_,
            expectedTag,
            frames.hasMark,
            frames.toPayee >= rescueAmount && frames.toOthers == 0
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
        uint8 expectedTag,
        bool hasMark,
        bool paysBeneficiary
    ) internal view {
        if (msg0 != 0) revert BadSigner();
        if (expectedTag != uint8(ILatch.State.EXPIRED)) revert BadTrigger();
        if (latch_ != address(latch) || eventId_ != eventId) revert BadTrigger();
        if (latchState != expectedTag) revert NotExpired();
        if (signer != owner) revert BadSigner();
        if (!hasMark) revert MissingRescueMark();
        if (!paysBeneficiary) revert BadPayout();
        if (balance < rescueAmount + gasBuffer) revert NoRoom();
    }

    /// Called by the account itself from the rescue cheque's SENDER frame.
    function markRescued() external {
        require(msg.sender == address(this), "self");
        rescued = true;
    }

    /// The balance is reserved for the beneficiary.
    function rescuePending() public view returns (bool) {
        if (rescued) return false;
        if (latch.state(eventId) != ILatch.State.EXPIRED) return false;
        return block.timestamp <= uint256(latch.deadline(eventId)) + rescueWindow;
    }

    function stake(uint32 delay) external payable onlyOwner {
        IStakingRegistry(stakingRegistry).addStake{value: msg.value}(delay);
    }

    /// Any state but "EXPIRED, the rescue has not landed, and the rescue window is still open". The oracle
    /// or another settlement can never freeze the owner's funds, leftovers after the rescue can be swept,
    /// and a rescue that never lands releases the funds once the window closes.
    function withdraw() external onlyOwner {
        if (rescuePending()) revert RescuePending();
        (bool ok,) = owner.call{value: address(this).balance}("");
        require(ok, "withdraw");
    }
}
