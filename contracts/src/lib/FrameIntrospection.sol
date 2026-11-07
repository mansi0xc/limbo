// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {HegotaSupport} from "@forshtat/hegota-support/contracts/HegotaSupport.sol";
import {TxParam, FrameParam, FrameMode} from "@forshtat/hegota-support/contracts/Params.sol";

/// Reads the transaction's own frames from inside a VERIFY frame.
///
/// The accounts use it to make a signed transaction carry what the signer could otherwise leave out: an
/// ABORT cheque must mark the DLC as aborted, and a rescue must mark the rescue as paid and actually pay
/// the beneficiary.
abstract contract FrameIntrospection is HegotaSupport {
    /// The smallest execution gas limit we accept on a marking frame. A marking frame does one cold SSTORE
    /// (0 -> 1); a smaller limit would let a signer include the frame and still have it run out of gas.
    uint256 internal constant MARK_MIN_GAS = 25_000;

    /// The smallest execution gas limit we count on a payout frame, for the same reason.
    uint256 internal constant PAY_MIN_GAS = 10_000;

    /// Summary of the SENDER frames of the current transaction.
    struct SenderFrames {
        /// A SENDER frame calls `address(this)` with `selector`, zero value and at least MARK_MIN_GAS.
        bool hasMark;
        /// Every SENDER frame is a zero-value call to `address(this)`.
        bool onlySelfCalls;
        /// Total value sent to `payee` by SENDER frames with at least PAY_MIN_GAS.
        uint256 toPayee;
        /// Total value sent anywhere else (including payee frames below PAY_MIN_GAS).
        uint256 toOthers;
    }

    function _senderFrames(bytes4 selector, address payee) internal view returns (SenderFrames memory out) {
        out.onlySelfCalls = true;
        uint256 count = txparam(TxParam.FRAME_COUNT);
        for (uint256 i = 0; i < count; i++) {
            if (frameparam(i, FrameParam.MODE) != uint256(FrameMode.SENDER)) continue;

            address target = address(uint160(frameparam(i, FrameParam.RESOLVED_TARGET)));
            uint256 value = frameparam(i, FrameParam.VALUE);
            uint256 gasLimit = frameparam(i, FrameParam.EXECUTION_GAS_LIMIT);

            if (value > 0) {
                if (payee != address(0) && target == payee && gasLimit >= PAY_MIN_GAS) {
                    out.toPayee += value;
                } else {
                    out.toOthers += value;
                }
            }

            if (target != address(this) || value != 0) {
                out.onlySelfCalls = false;
                continue;
            }

            if (out.hasMark) continue;
            if (frameparam(i, FrameParam.DATA_LENGTH) < 4) continue;
            if (bytes4(framedataload(0, i)) != selector) continue;
            if (gasLimit < MARK_MIN_GAS) continue;
            out.hasMark = true;
        }
    }
}
