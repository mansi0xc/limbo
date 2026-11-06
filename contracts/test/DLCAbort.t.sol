// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Latch} from "../src/Latch.sol";
import {DLCAccount} from "../src/DLCAccount.sol";
import {ILatch} from "../src/interfaces/ILatch.sol";
import {TestBase} from "./TestBase.sol";
import {DLCAccountHarness} from "./DLCAccountHarness.sol";

contract DLCAbortTest is TestBase {
    Latch internal latch;
    DLCAccountHarness internal account;

    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    address internal constant CAROL = address(0xCA401);
    address internal constant ORACLE = address(0x0B0B);
    bytes32 internal constant EVENT = keccak256("dlc");

    function setUp() public {
        latch = new Latch(ALICE, ORACLE, 100, 10);
        account = new DLCAccountHarness(
            ALICE,
            BOB,
            latch,
            EVENT,
            0.99 ether,
            0.99 ether,
            0.02 ether,
            address(0x1234)
        );
        vm.warp(1000);
    }

    function fundAlice() internal {
        vm.deal(ALICE, 10 ether);
        vm.prank(ALICE);
        account.deposit{value: 1 ether}();
    }

    function fundBoth() internal {
        fundAlice();
        vm.deal(BOB, 10 ether);
        vm.prank(BOB);
        account.deposit{value: 1 ether}();
    }

    function testAbortOneSidedAlice() public {
        fundAlice();
        account.verify(
            ALICE,
            address(0),
            0,
            0,
            uint8(ILatch.State.UNSET),
            1.02 ether,
            address(latch),
            EVENT,
            account.ABORT_TAG()
        );
    }

    function testAbortOneSidedBob() public {
        vm.deal(BOB, 10 ether);
        vm.prank(BOB);
        account.deposit{value: 1 ether}();
        account.verify(
            BOB,
            address(0),
            0,
            0,
            uint8(ILatch.State.UNSET),
            1.02 ether,
            address(latch),
            EVENT,
            account.ABORT_TAG()
        );
    }

    function testAbortNeverFunded() public {
        fundAlice();
        vm.expectRevert(DLCAccount.NotFunded.selector);
        account.verify(
            BOB,
            address(0),
            0,
            0,
            uint8(ILatch.State.UNSET),
            1.02 ether,
            address(latch),
            EVENT,
            4
        );
    }

    function testAbortNonCanonicalMsg() public {
        fundAlice();
        vm.expectRevert(DLCAccount.BadSigner.selector);
        account.verify(
            ALICE,
            address(0),
            1,
            0,
            uint8(ILatch.State.UNSET),
            1.02 ether,
            address(latch),
            EVENT,
            4
        );
    }

    function testAbortBothFunded() public {
        fundBoth();
        vm.expectRevert(DLCAccount.AlreadyFunded.selector);
        account.verify(
            ALICE,
            address(0),
            0,
            0,
            uint8(ILatch.State.UNSET),
            2.02 ether,
            address(latch),
            EVENT,
            4
        );
    }

    function testAbortWrongSigner() public {
        fundAlice();
        vm.expectRevert(DLCAccount.BadSigner.selector);
        account.verify(
            CAROL,
            address(0),
            0,
            0,
            uint8(ILatch.State.UNSET),
            1.02 ether,
            address(latch),
            EVENT,
            4
        );
    }

    function testAbortNoRoom() public {
        fundAlice();
        vm.expectRevert(DLCAccount.NoRoom.selector);
        account.verify(
            ALICE,
            address(0),
            0,
            0,
            uint8(ILatch.State.UNSET),
            1 ether,
            address(latch),
            EVENT,
            4
        );
    }

    function testMarkAborted() public {
        vm.prank(address(account));
        account.markAborted();
        assertTrue(account.aborted());

        vm.deal(ALICE, 10 ether);
        vm.startPrank(ALICE);
        vm.expectRevert(DLCAccount.AlreadyAborted.selector);
        account.deposit{value: 1 ether}();
        vm.stopPrank();

        vm.expectRevert(DLCAccount.AlreadyAborted.selector);
        account.verify(
            ALICE,
            BOB,
            0,
            0,
            uint8(ILatch.State.YES),
            2 ether,
            address(latch),
            EVENT,
            uint8(ILatch.State.YES)
        );
    }

    function testMarkAbortedOnlySelf() public {
        vm.startPrank(ALICE);
        vm.expectRevert(bytes("self"));
        account.markAborted();
        vm.stopPrank();
    }

    function testAbortAfterAborted() public {
        vm.prank(address(account));
        account.markAborted();
        vm.expectRevert(DLCAccount.AlreadyAborted.selector);
        account.verify(
            ALICE,
            address(0),
            0,
            0,
            uint8(ILatch.State.UNSET),
            1.02 ether,
            address(latch),
            EVENT,
            4
        );
    }
}
