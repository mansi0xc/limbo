// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {QuoteBook, IERC20} from "../src/QuoteBook.sol";
import {TestToken} from "../src/TestToken.sol";
import {Scope, TxParam, FrameParam} from "@forshtat/hegota-support/contracts/Params.sol";
import {TestBase} from "./TestBase.sol";

contract QuoteBookHarness is QuoteBook {
    mapping(uint256 => uint256) public txParams;
    mapping(uint256 => mapping(uint256 => uint256)) public frameParams;
    mapping(uint256 => mapping(uint256 => bytes32)) public frameData;
    uint256 public approved;

    constructor(
        address maker_,
        IERC20 token_,
        address stakingRegistry_,
        uint256 minTrade_,
        uint256 maxPriorityFee_,
        uint256 maxFee_,
        uint256 maxExecutionGas_
    ) QuoteBook(maker_, token_, stakingRegistry_, minTrade_, maxPriorityFee_, maxFee_, maxExecutionGas_) {}

    function setTxParam(TxParam param, uint256 value) external {
        txParams[uint256(param)] = value;
    }

    function setFrameParam(uint256 index, FrameParam param, uint256 value) external {
        frameParams[index][uint256(param)] = value;
    }

    function setFrameData(uint256 index, uint256 offset, bytes32 value) external {
        frameData[index][offset] = value;
    }

    function _txParam(TxParam param) internal view override returns (uint256) {
        return txParams[uint256(param)];
    }

    function _frameParam(uint256 index, FrameParam param) internal view override returns (uint256) {
        return frameParams[index][uint256(param)];
    }

    function _frameDataLoad(uint256 offset, uint256 index) internal view override returns (bytes32) {
        return frameData[index][offset];
    }

    function _approve(Scope scope) internal override {
        approved = uint256(scope);
    }

    function validateForTest(uint64 s, uint128 amountIn, uint128 minOut) external {
        _validateTake(s, amountIn, minOut);
    }

    function takeForTest(uint64 s, uint128 minOut) external payable {
        _take(s, minOut);
    }

    function assertForTest() external view {
        _assertFilled();
    }
}

contract QuoteBookTest is TestBase {
    TestToken internal token;
    QuoteBookHarness internal book;

    address internal constant MAKER = address(0xA11CE);
    address internal constant TRADER = address(0xB0B);
    address internal constant OTHER = address(0xCAFE);

    function setUp() public {
        token = new TestToken(1_000_000 ether);
        book = new QuoteBookHarness(MAKER, IERC20(address(token)), address(0x1234), 1 ether, 2 gwei, 10 gwei, 500_000);
        token.transfer(address(book), 1_000 ether);
        vm.roll(100);
        vm.prank(MAKER);
        book.postQuote(1, 2e18, 10 ether);
    }

    function setValidateFrame(uint64 s, uint128 amountIn, uint128 minOut) internal {
        book.setTxParam(TxParam.SENDER, uint256(uint160(TRADER)));
        book.setTxParam(TxParam.FRAME_COUNT, 3);
        book.setTxParam(TxParam.CURRENT_FRAME_INDEX, 1);
        book.setTxParam(TxParam.MAX_PRIORITY_FEE_PER_GAS, 1 gwei);
        book.setTxParam(TxParam.MAX_FEE, 2 gwei);

        book.setFrameParam(0, FrameParam.MODE, 1);
        book.setFrameParam(0, FrameParam.ALLOWED_SCOPE, 2);
        book.setFrameParam(0, FrameParam.RESOLVED_TARGET, uint256(uint160(TRADER)));
        book.setFrameParam(0, FrameParam.EXECUTION_GAS_LIMIT, 100_000);
        book.setFrameParam(1, FrameParam.EXECUTION_GAS_LIMIT, 100_000);
        book.setFrameParam(2, FrameParam.EXECUTION_GAS_LIMIT, 100_000);
        book.setFrameParam(2, FrameParam.MODE, 2);
        book.setFrameParam(2, FrameParam.RESOLVED_TARGET, uint256(uint160(address(book))));
        book.setFrameParam(2, FrameParam.VALUE, uint256(amountIn));
        book.setFrameData(2, 0, bytes32(book.take.selector));
        book.setFrameData(2, 4, bytes32(uint256(s)));
        book.setFrameData(2, 36, bytes32(uint256(minOut)));
    }

    function setTakeGate(uint64 s, uint128 amountIn, uint128 minOut) internal {
        book.setTxParam(TxParam.CURRENT_FRAME_INDEX, 2);
        book.setFrameParam(1, FrameParam.MODE, 1);
        book.setFrameParam(1, FrameParam.ALLOWED_SCOPE, 1);
        book.setFrameParam(1, FrameParam.STATUS, 1);
        book.setFrameParam(1, FrameParam.RESOLVED_TARGET, uint256(uint160(address(book))));
        book.setFrameData(1, 0, bytes32(book.validateTake.selector));
        book.setFrameData(1, 4, bytes32(uint256(s)));
        book.setFrameData(1, 36, bytes32(uint256(amountIn)));
        book.setFrameData(1, 68, bytes32(uint256(minOut)));
    }

    function testValidateApprovesPayment() public {
        setValidateFrame(1, 1 ether, 2 ether);
        book.validateForTest(1, 1 ether, 2 ether);
        assertEq(book.approved(), 1);
    }

    function testStaleQuote() public {
        setValidateFrame(2, 1 ether, 2 ether);
        vm.expectRevert(QuoteBook.Stale.selector);
        book.validateForTest(2, 1 ether, 2 ether);
    }

    function testWrongBlock() public {
        setValidateFrame(1, 1 ether, 2 ether);
        vm.roll(101);
        vm.expectRevert(QuoteBook.NotThisBlock.selector);
        book.validateForTest(1, 1 ether, 2 ether);
    }

    function testOversize() public {
        setValidateFrame(1, 11 ether, 2 ether);
        vm.expectRevert(QuoteBook.BadSize.selector);
        book.validateForTest(1, 11 ether, 2 ether);
    }

    function testWrongSelector() public {
        setValidateFrame(1, 1 ether, 2 ether);
        book.setFrameData(2, 0, bytes32(bytes4(0xdeadbeef)));
        vm.expectRevert(QuoteBook.BadFrame.selector);
        book.validateForTest(1, 1 ether, 2 ether);
    }

    function testGateBypass() public {
        setTakeGate(1, 1 ether, 2 ether);
        book.setFrameParam(1, FrameParam.STATUS, 0);
        vm.deal(TRADER, 10 ether);
        vm.prank(TRADER);
        vm.expectRevert(QuoteBook.BadFrame.selector);
        book.takeForTest{value: 1 ether}(1, 2 ether);
    }

    function testAssertFilled() public {
        book.setFrameParam(2, FrameParam.STATUS, 0);
        vm.expectRevert(QuoteBook.NotFilled.selector);
        book.assertForTest();
    }

    function testOnlyMakerQuotes() public {
        vm.startPrank(OTHER);
        vm.expectRevert(QuoteBook.NotMaker.selector);
        book.postQuote(2, 1e18, 10 ether);
        vm.stopPrank();
    }

    function testTakeSettlesOnce() public {
        setTakeGate(1, 1 ether, 2 ether);
        vm.deal(TRADER, 10 ether);
        vm.prank(TRADER);
        book.takeForTest{value: 1 ether}(1, 2 ether);
        assertEq(token.balanceOf(TRADER), 2 ether);
        assertTrue(book.taken(1));

        vm.prank(TRADER);
        vm.expectRevert(QuoteBook.AlreadyTaken.selector);
        book.takeForTest{value: 1 ether}(1, 2 ether);
    }
}
