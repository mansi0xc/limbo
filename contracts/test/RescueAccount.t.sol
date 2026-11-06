// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Latch} from "../src/Latch.sol";
import {RescueAccount} from "../src/RescueAccount.sol";
import {ILatch} from "../src/interfaces/ILatch.sol";
import {TestBase} from "./TestBase.sol";

contract RescueAccountHarness is RescueAccount {
    constructor(
        address owner_,
        address beneficiary_,
        ILatch latch_,
        bytes32 eventId_,
        uint256 rescueAmount_,
        uint256 gasBuffer_,
        address stakingRegistry_
    ) RescueAccount(owner_, beneficiary_, latch_, eventId_, rescueAmount_, gasBuffer_, stakingRegistry_) {}

    function verify(
        address signer,
        uint256 msg0,
        uint8 latchState,
        uint256 balance,
        address latch_,
        bytes32 eventId_,
        uint8 expectedTag
    ) external view {
        _verify(signer, msg0, latchState, balance, latch_, eventId_, expectedTag);
    }
}

contract RescueAccountTest is TestBase {
    Latch internal latch;
    RescueAccountHarness internal account;

    address internal constant OWNER = address(0xA11CE);
    address internal constant BENEFICIARY = address(0xB0B);
    address internal constant OTHER = address(0xCAFE);
    bytes32 internal constant EVENT = keccak256("rescue");

    function setUp() public {
        latch = new Latch(OWNER, address(0), 100, 10);
        account = new RescueAccountHarness(
            OWNER,
            BENEFICIARY,
            latch,
            EVENT,
            0.1 ether,
            0.01 ether,
            address(0x1234)
        );
        vm.warp(1000);
    }

    function testExpiredPasses() public view {
        account.verify(OWNER, 0, uint8(ILatch.State.EXPIRED), 1 ether, address(latch), EVENT, uint8(ILatch.State.EXPIRED));
    }

    function testWrongSigner() public {
        vm.expectRevert(RescueAccount.BadSigner.selector);
        account.verify(OTHER, 0, uint8(ILatch.State.EXPIRED), 1 ether, address(latch), EVENT, uint8(ILatch.State.EXPIRED));
    }

    function testNonCanonicalMsg() public {
        vm.expectRevert(RescueAccount.BadSigner.selector);
        account.verify(OWNER, 1, uint8(ILatch.State.EXPIRED), 1 ether, address(latch), EVENT, uint8(ILatch.State.EXPIRED));
    }

    function testWrongTag() public {
        vm.expectRevert(RescueAccount.BadTrigger.selector);
        account.verify(OWNER, 0, uint8(ILatch.State.NO), 1 ether, address(latch), EVENT, uint8(ILatch.State.NO));
    }

    function testWrongLatch() public {
        vm.expectRevert(RescueAccount.BadTrigger.selector);
        account.verify(OWNER, 0, uint8(ILatch.State.EXPIRED), 1 ether, address(0xDEAD), EVENT, uint8(ILatch.State.EXPIRED));
    }

    function testWrongEvent() public {
        vm.expectRevert(RescueAccount.BadTrigger.selector);
        account.verify(
            OWNER,
            0,
            uint8(ILatch.State.EXPIRED),
            1 ether,
            address(latch),
            keccak256("other"),
            uint8(ILatch.State.EXPIRED)
        );
    }

    function testPreExpiry() public {
        vm.expectRevert(RescueAccount.NotExpired.selector);
        account.verify(OWNER, 0, uint8(ILatch.State.UNSET), 1 ether, address(latch), EVENT, uint8(ILatch.State.EXPIRED));
    }

    function testNoRoom() public {
        vm.expectRevert(RescueAccount.NoRoom.selector);
        account.verify(OWNER, 0, uint8(ILatch.State.EXPIRED), 0.1 ether, address(latch), EVENT, uint8(ILatch.State.EXPIRED));
    }

    function testWithdrawOnlyOwner() public {
        vm.deal(address(account), 1 ether);
        vm.startPrank(OTHER);
        vm.expectRevert(bytes("not owner"));
        account.withdraw();
        vm.stopPrank();

        vm.prank(OWNER);
        account.withdraw();
        assertEq(OWNER.balance, 1 ether);
    }

    function testWithdrawAfterExpire() public {
        vm.prank(OWNER);
        latch.ping(EVENT);
        vm.warp(1111);
        latch.expire(EVENT);
        vm.deal(address(account), 1 ether);
        vm.startPrank(OWNER);
        vm.expectRevert(bytes("settled"));
        account.withdraw();
        vm.stopPrank();
    }
}
