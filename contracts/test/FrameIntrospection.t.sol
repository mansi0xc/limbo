// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {HegotaSupport} from "@forshtat/hegota-support/contracts/HegotaSupport.sol";
import {Devnet} from "@forshtat/hegota-support/contracts/Devnet.sol";
import {TxParam, FrameParam, FrameMode} from "@forshtat/hegota-support/contracts/Params.sol";
import {HelperCode} from "@forshtat/hegota-support/contracts/generated/HelperCode.sol";
import {FrameIntrospection} from "../src/lib/FrameIntrospection.sol";
import {TestBase} from "./TestBase.sol";

contract IntrospectionProbe is HegotaSupport(Devnet.ERC8421_WORKSHOP), FrameIntrospection {
    function frames(bytes4 selector, address payee) external view returns (SenderFrames memory) {
        return _senderFrames(selector, payee);
    }

    function markRescued() external {}
}

/// Runs the real `_senderFrames` loop. Foundry has no frame opcodes, so the opcode helpers that
/// HegotaSupport deploys are mocked with the words the devnet would return. This checks the frame
/// indexes, the parameter ids and the selector extraction, not the opcodes themselves.
contract FrameIntrospectionTest is TestBase {
    IntrospectionProbe internal probe;
    address internal txParamHelper;
    address internal frameDataLoadHelper;
    address internal frameParamHelper;

    address internal constant BENEFICIARY = address(0xB0B);
    address internal constant OTHER = address(0xCAFE);

    struct F {
        uint256 mode;
        address target;
        uint256 value;
        uint256 gasLimit;
        bytes4 selector;
        uint256 dataLength;
    }

    function setUp() public {
        probe = new IntrospectionProbe();

        // HegotaSupport's constructor CREATEs one helper per opcode the devnet has, in a fixed order,
        // starting at the probe's nonce 1. Rebuild that order to find the helpers we mock.
        bytes[9] memory codes = [
            HelperCode.approve(Devnet.ERC8421_WORKSHOP),
            HelperCode.txParam(Devnet.ERC8421_WORKSHOP),
            HelperCode.frameDataLoad(Devnet.ERC8421_WORKSHOP),
            HelperCode.frameDataCopy(Devnet.ERC8421_WORKSHOP),
            HelperCode.frameParam(Devnet.ERC8421_WORKSHOP),
            HelperCode.sigParam(Devnet.ERC8421_WORKSHOP),
            HelperCode.sigDataCopy(Devnet.ERC8421_WORKSHOP),
            HelperCode.txTrace(Devnet.ERC8421_WORKSHOP),
            HelperCode.eventDataCopy(Devnet.ERC8421_WORKSHOP)
        ];
        address[9] memory helpers;
        uint256 nonce = 1;
        for (uint256 i = 0; i < 9; i++) {
            if (codes[i].length == 0) continue;
            helpers[i] = createAddress(address(probe), nonce++);
        }
        txParamHelper = helpers[1];
        frameDataLoadHelper = helpers[2];
        frameParamHelper = helpers[4];
        require(txParamHelper.code.length > 0 && frameParamHelper.code.length > 0, "helpers not found");
    }

    function createAddress(address deployer, uint256 nonce) internal pure returns (address) {
        require(nonce > 0 && nonce < 0x80, "nonce");
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xd6), bytes1(0x94), deployer, uint8(nonce))))));
    }

    function mockFrames(F[] memory fs) internal {
        vm.mockCall(txParamHelper, abi.encode(TxParam.FRAME_COUNT), abi.encode(fs.length));
        for (uint256 i = 0; i < fs.length; i++) {
            vm.mockCall(frameParamHelper, abi.encode(i, FrameParam.MODE), abi.encode(fs[i].mode));
            vm.mockCall(frameParamHelper, abi.encode(i, FrameParam.RESOLVED_TARGET), abi.encode(uint256(uint160(fs[i].target))));
            vm.mockCall(frameParamHelper, abi.encode(i, FrameParam.VALUE), abi.encode(fs[i].value));
            vm.mockCall(frameParamHelper, abi.encode(i, FrameParam.EXECUTION_GAS_LIMIT), abi.encode(fs[i].gasLimit));
            vm.mockCall(frameParamHelper, abi.encode(i, FrameParam.DATA_LENGTH), abi.encode(fs[i].dataLength));
            vm.mockCall(frameDataLoadHelper, abi.encode(uint256(0), i), abi.encode(bytes32(fs[i].selector)));
        }
    }

    function verifyFrame(uint256 limit) internal view returns (F memory) {
        return F(uint256(FrameMode.VERIFY), address(probe), 0, limit, bytes4(0), 96);
    }

    function selfCall(bytes4 selector, uint256 gasLimit) internal view returns (F memory) {
        return F(uint256(FrameMode.SENDER), address(probe), 0, gasLimit, selector, 4);
    }

    function pay(address to, uint256 value, uint256 gasLimit) internal pure returns (F memory) {
        return F(uint256(FrameMode.SENDER), to, value, gasLimit, bytes4(0), 0);
    }

    /// The shape `buildLatchedTx` produces for a rescue: expiry, self_verify, mark, payout.
    function testRescueShape() public {
        F[] memory fs = new F[](4);
        fs[0] = F(uint256(FrameMode.VERIFY), address(0x8141), 0, 30_000, bytes4(0), 8);
        fs[1] = verifyFrame(200_000);
        fs[2] = selfCall(probe.markRescued.selector, 50_000);
        fs[3] = pay(BENEFICIARY, 1 ether, 50_000);
        mockFrames(fs);

        FrameIntrospection.SenderFrames memory out = probe.frames(probe.markRescued.selector, BENEFICIARY);
        assertTrue(out.hasMark);
        assertTrue(!out.onlySelfCalls);
        assertEq(out.toPayee, 1 ether);
        assertEq(out.toOthers, 0);
    }

    function testMarkMissingAndPayoutElsewhere() public {
        F[] memory fs = new F[](3);
        fs[0] = verifyFrame(200_000);
        fs[1] = pay(OTHER, 1 ether, 50_000);
        fs[2] = selfCall(bytes4(0xdeadbeef), 50_000);
        mockFrames(fs);

        FrameIntrospection.SenderFrames memory out = probe.frames(probe.markRescued.selector, BENEFICIARY);
        assertTrue(!out.hasMark);
        assertEq(out.toPayee, 0);
        assertEq(out.toOthers, 1 ether);
    }

    /// A mark or payout frame with too little gas to run does not count.
    function testUnderGassedFramesDoNotCount() public {
        F[] memory fs = new F[](3);
        fs[0] = verifyFrame(200_000);
        fs[1] = selfCall(probe.markRescued.selector, 24_999);
        fs[2] = pay(BENEFICIARY, 1 ether, 9_999);
        mockFrames(fs);

        FrameIntrospection.SenderFrames memory out = probe.frames(probe.markRescued.selector, BENEFICIARY);
        assertTrue(!out.hasMark);
        assertEq(out.toPayee, 0);
        assertEq(out.toOthers, 1 ether);
    }

    /// The DLC abort shape: only zero-value self-calls, one of them the mark.
    function testAbortShape() public {
        F[] memory fs = new F[](3);
        fs[0] = verifyFrame(200_000);
        fs[1] = selfCall(probe.markRescued.selector, 50_000);
        fs[2] = selfCall(bytes4(0x12345678), 50_000);
        mockFrames(fs);

        FrameIntrospection.SenderFrames memory out = probe.frames(probe.markRescued.selector, address(0));
        assertTrue(out.hasMark);
        assertTrue(out.onlySelfCalls);
        assertEq(out.toOthers, 0);
    }

    /// With no payee (the DLC abort), any value-bearing frame breaks the abort shape.
    function testAbortWithPayoutBreaksShape() public {
        F[] memory fs = new F[](3);
        fs[0] = verifyFrame(200_000);
        fs[1] = selfCall(probe.markRescued.selector, 50_000);
        fs[2] = pay(OTHER, 1, 50_000);
        mockFrames(fs);

        FrameIntrospection.SenderFrames memory out = probe.frames(probe.markRescued.selector, address(0));
        assertTrue(out.hasMark);
        assertTrue(!out.onlySelfCalls);
        assertEq(out.toOthers, 1);
    }
}
