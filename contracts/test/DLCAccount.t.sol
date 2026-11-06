// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Latch} from "../src/Latch.sol";
import {DLCAccount} from "../src/DLCAccount.sol";
import {ILatch} from "../src/interfaces/ILatch.sol";
import {TestBase} from "./TestBase.sol";
import {DLCAccountHarness} from "./DLCAccountHarness.sol";

contract DLCAccountTest is TestBase {
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

    function testDepositBoth() public {
        fundBoth();
        assertEq(account.deposits(ALICE), 1 ether);
        assertEq(account.deposits(BOB), 1 ether);
        assertTrue(account.bothFunded());
    }

    function testDepositNotParty() public {
        vm.deal(CAROL, 1 ether);
        vm.startPrank(CAROL);
        vm.expectRevert(bytes("not party"));
        account.deposit{value: 1 ether}();
        vm.stopPrank();
    }

    function testDepositAfterAttest() public {
        vm.prank(ALICE);
        latch.ping(EVENT);
        vm.warp(1050);
        vm.prank(ORACLE);
        latch.attest(EVENT, true);
        vm.deal(ALICE, 10 ether);
        vm.startPrank(ALICE);
        vm.expectRevert(bytes("settled"));
        account.deposit{value: 1 ether}();
        vm.stopPrank();
    }

    function testYesPasses() public {
        fundBoth();
        account.verify(ALICE, BOB, uint8(ILatch.State.YES), 2 ether, address(latch), EVENT, uint8(ILatch.State.YES));
    }

    function testYesOneSigner() public {
        fundBoth();
        vm.expectRevert(DLCAccount.BadSigner.selector);
        account.verify(ALICE, address(0), uint8(ILatch.State.YES), 2 ether, address(latch), EVENT, uint8(ILatch.State.YES));
    }

    function testWrongTag() public {
        fundBoth();
        vm.expectRevert(DLCAccount.BadState.selector);
        account.verify(ALICE, BOB, uint8(ILatch.State.YES), 2 ether, address(latch), EVENT, uint8(ILatch.State.NO));
    }

    function testNotFunded() public {
        vm.expectRevert(DLCAccount.NotFunded.selector);
        account.verify(ALICE, BOB, uint8(ILatch.State.YES), 2 ether, address(latch), EVENT, uint8(ILatch.State.YES));
    }

    function testNoPayoutRoom() public {
        fundBoth();
        vm.expectRevert(DLCAccount.NoRoom.selector);
        account.verify(ALICE, BOB, uint8(ILatch.State.YES), 1.5 ether, address(latch), EVENT, uint8(ILatch.State.YES));
    }

    function testRefund() public {
        fundBoth();
        account.verify(
            ALICE,
            BOB,
            uint8(ILatch.State.EXPIRED),
            2.02 ether,
            address(latch),
            EVENT,
            uint8(ILatch.State.EXPIRED)
        );
    }

    function testRefundNoRoom() public {
        fundBoth();
        vm.expectRevert(DLCAccount.NoRoom.selector);
        account.verify(
            ALICE,
            BOB,
            uint8(ILatch.State.EXPIRED),
            2 ether - 1,
            address(latch),
            EVENT,
            uint8(ILatch.State.EXPIRED)
        );
    }

    function testRefundAfterExpire() public {
        fundBoth();
        vm.prank(ALICE);
        latch.ping(EVENT);
        vm.warp(1200);
        latch.expire(EVENT);
        account.verify(
            ALICE,
            BOB,
            uint8(ILatch.State.EXPIRED),
            2.02 ether,
            address(latch),
            EVENT,
            uint8(ILatch.State.EXPIRED)
        );
    }
}
