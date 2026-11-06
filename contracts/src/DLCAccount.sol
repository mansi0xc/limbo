// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {HegotaSupport} from "@forshtat/hegota-support/contracts/HegotaSupport.sol";
import {Devnet} from "@forshtat/hegota-support/contracts/Devnet.sol";
import {Scope, SigParam, TxParam} from "@forshtat/hegota-support/contracts/Params.sol";
import {ILatch} from "./interfaces/ILatch.sol";
import {IStakingRegistry} from "./interfaces/IStakingRegistry.sol";

/// A 2-of-2 binary DLC account. All outcome cheques share one EIP-8250 key at sequence 0, so the
/// first promoted value consumes the key and the siblings become invalid.
///
/// The refund after EXPIRED uses the recorded deposits. If only one side funded, either party can
/// sign an ABORT cheque alone; the abort also marks the account so later deposits are rejected.
contract DLCAccount is HegotaSupport(Devnet.ERC8421_WORKSHOP) {
    uint8 public constant ABORT_TAG = 4;

    address public immutable alice;
    address public immutable bob;
    ILatch public immutable latch;
    bytes32 public immutable eventId;
    uint256 public immutable payoutA;
    uint256 public immutable payoutB;
    uint256 public immutable gasBuffer;
    address public immutable stakingRegistry;

    mapping(address => uint256) public deposits;
    bool public bothFunded;
    bool public aborted;

    error BadTrigger();
    error BadState();
    error BadSigner();
    error NoRoom();
    error NotFunded();
    error AlreadyFunded();
    error AlreadyAborted();

    modifier onlyAlice() {
        require(msg.sender == alice, "not alice");
        _;
    }

    constructor(
        address alice_,
        address bob_,
        ILatch latch_,
        bytes32 eventId_,
        uint256 payoutA_,
        uint256 payoutB_,
        uint256 gasBuffer_,
        address stakingRegistry_
    ) payable {
        require(alice_ != address(0) && bob_ != address(0), "parties");
        require(address(latch_) != address(0), "latch");
        require(gasBuffer_ > 0, "buffer");
        alice = alice_;
        bob = bob_;
        latch = latch_;
        eventId = eventId_;
        payoutA = payoutA_;
        payoutB = payoutB_;
        gasBuffer = gasBuffer_;
        stakingRegistry = stakingRegistry_;
    }

    receive() external payable {}

    function deposit() external payable {
        require(msg.sender == alice || msg.sender == bob, "not party");
        if (aborted) revert AlreadyAborted();
        require(latch.state(eventId) == ILatch.State.UNSET, "settled");
        require(msg.value > 0, "zero");
        deposits[msg.sender] += msg.value;
        bothFunded = deposits[alice] > 0 && deposits[bob] > 0;
    }

    /// Called by the account itself from an ABORT cheque's SENDER frame, so no later deposit can be
    /// stranded behind the consumed nonce key.
    function markAborted() external {
        require(msg.sender == address(this), "self");
        aborted = true;
    }

    function stake(uint32 delay) external payable onlyAlice {
        IStakingRegistry(stakingRegistry).addStake{value: msg.value}(delay);
    }

    fallback() external payable {
        (address latch_, bytes32 eventId_, uint8 expectedTag) = abi.decode(msg.data, (address, bytes32, uint8));

        uint256 count = txparam(TxParam.SIGNATURE_COUNT);
        address signer0 = address(uint160(sigparam(0, SigParam.RESOLVED_SIGNER)));
        address signer1 = count > 1 ? address(uint160(sigparam(1, SigParam.RESOLVED_SIGNER))) : address(0);

        _verify(
            signer0,
            signer1,
            uint8(latch.state(eventId)),
            address(this).balance,
            latch_,
            eventId_,
            expectedTag
        );
        approve(Scope.EXECUTION_AND_PAYMENT);
    }

    function _verify(
        address signer0,
        address signer1,
        uint8 latchState,
        uint256 balance,
        address latch_,
        bytes32 eventId_,
        uint8 expectedTag
    ) internal view {
        if (latch_ != address(latch) || eventId_ != eventId) revert BadTrigger();
        if (aborted) revert AlreadyAborted();

        if (expectedTag == ABORT_TAG) {
            if (bothFunded) revert AlreadyFunded();
            if (signer0 != alice && signer0 != bob) revert BadSigner();
            if (balance < deposits[alice] + deposits[bob] + gasBuffer) revert NoRoom();
            return;
        }

        if (expectedTag < uint8(ILatch.State.YES) || expectedTag > uint8(ILatch.State.EXPIRED)) {
            revert BadTrigger();
        }
        if (latchState != expectedTag) revert BadState();
        if (signer0 != alice || signer1 != bob) revert BadSigner();

        if (expectedTag == uint8(ILatch.State.EXPIRED)) {
            if (balance < deposits[alice] + deposits[bob] + gasBuffer) revert NoRoom();
        } else {
            if (!bothFunded) revert NotFunded();
            if (balance < payoutA + payoutB + gasBuffer) revert NoRoom();
        }
    }
}
