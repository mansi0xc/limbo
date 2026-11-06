// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Latch} from "../src/Latch.sol";
import {ILatch} from "../src/interfaces/ILatch.sol";
import {TestBase} from "./TestBase.sol";

contract LatchTest is TestBase {
    Latch internal latch;

    address internal constant OWNER = address(0xA11CE);
    address internal constant ORACLE = address(0x0B0B);
    address internal constant OTHER = address(0xCAFE);
    bytes32 internal constant EVENT = keccak256("event");

    function setUp() public {
        latch = new Latch(OWNER, ORACLE, 100, 10);
        vm.warp(1000);
    }

    function testPingSetsDeadline() public {
        vm.prank(OWNER);
        latch.ping(EVENT);
        assertEq(uint256(latch.deadline(EVENT)), 1100);
        assertEq(uint256(uint8(latch.state(EVENT))), uint256(uint8(ILatch.State.UNSET)));
    }

    function testPingOnlyOwner() public {
        vm.startPrank(OTHER);
        vm.expectRevert(Latch.NotOwner.selector);
        latch.ping(EVENT);
        vm.stopPrank();
    }

    function testOpenFixedDeadline() public {
        vm.prank(OWNER);
        latch.open(EVENT, 2000);
        assertEq(uint256(latch.deadline(EVENT)), 2000);
        assertTrue(latch.locked(EVENT));
    }

    function testOpenOnlyOwner() public {
        vm.startPrank(OTHER);
        vm.expectRevert(Latch.NotOwner.selector);
        latch.open(EVENT, 2000);
        vm.stopPrank();
    }

    function testOpenOnce() public {
        vm.prank(OWNER);
        latch.open(EVENT, 2000);
        vm.startPrank(OWNER);
        vm.expectRevert(Latch.AlreadyOpened.selector);
        latch.open(EVENT, 3000);
        vm.stopPrank();
    }

    function testOpenInPast() public {
        vm.startPrank(OWNER);
        vm.expectRevert(Latch.DeadlineInPast.selector);
        latch.open(EVENT, 999);
        vm.stopPrank();
    }

    function testPingLockedAfterOpen() public {
        vm.prank(OWNER);
        latch.open(EVENT, 2000);
        vm.startPrank(OWNER);
        vm.expectRevert(Latch.Locked.selector);
        latch.ping(EVENT);
        vm.stopPrank();
    }

    function testAttest() public {
        vm.prank(OWNER);
        latch.open(EVENT, 1100);
        vm.warp(1050);
        vm.prank(ORACLE);
        latch.attest(EVENT, true);
        assertEq(uint256(uint8(latch.state(EVENT))), uint256(uint8(ILatch.State.YES)));
    }

    function testAttestLate() public {
        vm.prank(OWNER);
        latch.open(EVENT, 1100);
        vm.warp(1101);
        vm.startPrank(ORACLE);
        vm.expectRevert(Latch.DeadlinePassed.selector);
        latch.attest(EVENT, true);
        vm.stopPrank();
    }

    function testAttestOnlyOracle() public {
        vm.prank(OWNER);
        latch.open(EVENT, 1100);
        vm.warp(1050);
        vm.startPrank(OTHER);
        vm.expectRevert(Latch.NotOracle.selector);
        latch.attest(EVENT, true);
        vm.stopPrank();
    }

    function testExpireAfterGrace() public {
        vm.prank(OWNER);
        latch.ping(EVENT);
        vm.warp(1111);
        latch.expire(EVENT);
        assertEq(uint256(uint8(latch.state(EVENT))), uint256(uint8(ILatch.State.EXPIRED)));
    }

    function testExpireEarly() public {
        vm.prank(OWNER);
        latch.ping(EVENT);
        vm.warp(1100);
        vm.expectRevert(Latch.GraceNotPassed.selector);
        latch.expire(EVENT);
        vm.warp(1111);
        latch.expire(EVENT);
        assertEq(uint256(uint8(latch.state(EVENT))), uint256(uint8(ILatch.State.EXPIRED)));
    }

    function testExpireWithoutDeadline() public {
        vm.expectRevert(Latch.NotOpened.selector);
        latch.expire(EVENT);
    }

    function testWriteOnce() public {
        vm.prank(OWNER);
        latch.open(EVENT, 1100);
        vm.warp(1050);
        vm.prank(ORACLE);
        latch.attest(EVENT, false);
        vm.startPrank(ORACLE);
        vm.expectRevert(Latch.Settled.selector);
        latch.attest(EVENT, true);
        vm.stopPrank();
        vm.expectRevert(Latch.Settled.selector);
        latch.expire(EVENT);
    }

    function testPingAfterAttest() public {
        vm.prank(OWNER);
        latch.open(EVENT, 1100);
        vm.warp(1050);
        vm.prank(ORACLE);
        latch.attest(EVENT, true);
        vm.startPrank(OWNER);
        vm.expectRevert(Latch.Locked.selector);
        latch.ping(EVENT);
        vm.stopPrank();
    }

    /// A heartbeat event can only end in EXPIRED; the oracle cannot settle it.
    function testAttestHeartbeatRejected() public {
        vm.prank(OWNER);
        latch.ping(EVENT);
        vm.warp(1050);
        vm.startPrank(ORACLE);
        vm.expectRevert(Latch.NotFixed.selector);
        latch.attest(EVENT, true);
        vm.stopPrank();
    }
}
