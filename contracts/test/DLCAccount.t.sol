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
            1 ether,
            1 ether,
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
        latch.open(EVENT, 1100);
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
        account.verify(ALICE, BOB, 0, 0, uint8(ILatch.State.YES), 2 ether, address(latch), EVENT, uint8(ILatch.State.YES));
    }

    function testYesOneSigner() public {
        fundBoth();
        vm.expectRevert(DLCAccount.BadSigner.selector);
        account.verify(ALICE, address(0), 0, 0, uint8(ILatch.State.YES), 2 ether, address(latch), EVENT, uint8(ILatch.State.YES));
    }

    function testWrongTag() public {
        fundBoth();
        vm.expectRevert(DLCAccount.BadState.selector);
        account.verify(ALICE, BOB, 0, 0, uint8(ILatch.State.YES), 2 ether, address(latch), EVENT, uint8(ILatch.State.NO));
    }

    function testNotFunded() public {
        vm.expectRevert(DLCAccount.NotFunded.selector);
        account.verify(ALICE, BOB, 0, 0, uint8(ILatch.State.YES), 2 ether, address(latch), EVENT, uint8(ILatch.State.YES));
    }

    function testNoPayoutRoom() public {
        fundBoth();
        vm.expectRevert(DLCAccount.NoRoom.selector);
        account.verify(ALICE, BOB, 0, 0, uint8(ILatch.State.YES), 1.5 ether, address(latch), EVENT, uint8(ILatch.State.YES));
    }

    function testNonCanonicalMsg() public {
        fundBoth();
        vm.expectRevert(DLCAccount.BadSigner.selector);
        account.verify(ALICE, BOB, 1, 0, uint8(ILatch.State.YES), 2 ether, address(latch), EVENT, uint8(ILatch.State.YES));
    }

    function testNonCanonicalSecondMsg() public {
        fundBoth();
        vm.expectRevert(DLCAccount.BadSigner.selector);
        account.verify(ALICE, BOB, 0, 1, uint8(ILatch.State.YES), 2 ether, address(latch), EVENT, uint8(ILatch.State.YES));
    }

    function testRefund() public {
        fundBoth();
        account.verify(
            ALICE,
            BOB,
            0,
            0,
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
            0,
            0,
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
            0,
            0,
            uint8(ILatch.State.EXPIRED),
            2.02 ether,
            address(latch),
            EVENT,
            uint8(ILatch.State.EXPIRED)
        );
    }

    /// A dust deposit does not count as funding: the account stays unfunded and the other side can still abort.
    function testDustDepositDoesNotFund() public {
        fundAlice();
        vm.deal(BOB, 1 ether);
        vm.prank(BOB);
        account.deposit{value: 1}();
        assertTrue(!account.bothFunded());
        account.verify(ALICE, address(0), 0, 0, 0, 1.02 ether + 1, address(latch), EVENT, account.ABORT_TAG());
    }

    function testStakeThreshold() public {
        fundAlice();
        vm.deal(BOB, 10 ether);
        vm.prank(BOB);
        account.deposit{value: 0.5 ether}();
        assertTrue(!account.bothFunded());
        vm.prank(BOB);
        account.deposit{value: 0.5 ether}();
        assertTrue(account.bothFunded());
    }

    function testPayoutsCannotExceedStakes() public {
        vm.expectRevert(bytes("payouts exceed stakes"));
        new DLCAccountHarness(ALICE, BOB, latch, EVENT, 1 ether, 1 ether, 1.5 ether, 0.6 ether, 0.02 ether, address(0x1234));
    }

    /// A side cannot deposit more than its stake, so no excess is stranded behind the fixed-amount cheques.
    function testDepositCappedAtStake() public {
        vm.deal(ALICE, 10 ether);
        vm.startPrank(ALICE);
        vm.expectRevert(bytes("over stake"));
        account.deposit{value: 1 ether + 1}();
        account.deposit{value: 0.6 ether}();
        vm.expectRevert(bytes("over stake"));
        account.deposit{value: 0.5 ether}();
        account.deposit{value: 0.4 ether}();
        vm.stopPrank();
        assertEq(account.deposits(ALICE), 1 ether);
    }
}
