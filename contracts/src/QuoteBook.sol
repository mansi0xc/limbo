// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {HegotaSupport} from "@forshtat/hegota-support/contracts/HegotaSupport.sol";
import {Devnet} from "@forshtat/hegota-support/contracts/Devnet.sol";
import {Scope, TxParam, FrameParam} from "@forshtat/hegota-support/contracts/Params.sol";
import {IStakingRegistry} from "./interfaces/IStakingRegistry.sol";

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// A same-block quote book for PRED. The maker posts one quote per block; a trade is valid only while
/// that quote is the latest one and was posted in this block. `validateTake` is the trade's pay frame
/// and approves the book as payer; `take` is the SENDER frame that settles the token leg.
contract QuoteBook is HegotaSupport(Devnet.ERC8421_WORKSHOP) {
    address public immutable maker;
    IERC20 public immutable token;
    address public immutable stakingRegistry;
    uint256 public immutable minTrade;
    uint256 public immutable maxPriorityFee;
    uint256 public immutable maxFee;
    uint256 public immutable maxExecutionGas;

    uint64 public lastSeq;
    uint256 public quoteBlock;
    uint128 public price;
    uint128 public sizeLeft;
    mapping(uint64 => bool) public taken;

    error NotMaker();
    error Stale();
    error NotThisBlock();
    error BadShape();
    error BadFrame();
    error BadSize();
    error BadPrice();
    error BadFee();
    error BadGas();
    error AlreadyTaken();
    error NotFilled();
    error TransferFailed();

    event QuotePosted(uint64 indexed seq, uint256 blockNumber, uint128 price, uint128 maxSize);
    event Taken(uint64 indexed seq, address indexed trader, uint256 amountIn, uint256 amountOut);

    modifier onlyMaker() {
        if (msg.sender != maker) revert NotMaker();
        _;
    }

    constructor(
        address maker_,
        IERC20 token_,
        address stakingRegistry_,
        uint256 minTrade_,
        uint256 maxPriorityFee_,
        uint256 maxFee_,
        uint256 maxExecutionGas_
    ) {
        require(maker_ != address(0), "maker");
        require(address(token_) != address(0), "token");
        maker = maker_;
        token = token_;
        stakingRegistry = stakingRegistry_;
        minTrade = minTrade_;
        maxPriorityFee = maxPriorityFee_;
        maxFee = maxFee_;
        maxExecutionGas = maxExecutionGas_;
    }

    receive() external payable {}

    function postQuote(uint64 s, uint128 price_, uint128 maxSize) external onlyMaker {
        if (s <= lastSeq) revert Stale();
        if (price_ == 0 || maxSize == 0) revert BadPrice();
        lastSeq = s;
        quoteBlock = block.number;
        price = price_;
        sizeLeft = maxSize;
        taken[s] = false;
        emit QuotePosted(s, block.number, price_, maxSize);
    }

    /// The trade's pay frame. It approves PAYMENT only if this block's quote is the latest and the
    /// trade's frames are exactly the expected shape.
    function validateTake(uint64 s, uint128 amountIn, uint128 minOut) external {
        _validateTake(s, amountIn, minOut);
    }

    function _validateTake(uint64 s, uint128 amountIn, uint128 minOut) internal {
        if (lastSeq != s) revert Stale();
        if (quoteBlock != block.number) revert NotThisBlock();

        address trader = address(uint160(_txParam(TxParam.SENDER)));
        uint256 frameCount = _txParam(TxParam.FRAME_COUNT);
        if (frameCount != 3 && frameCount != 4) revert BadShape();
        if (_txParam(TxParam.CURRENT_FRAME_INDEX) != 1) revert BadFrame();

        // Frame 0: the trader's only_verify frame.
        if (_frameParam(0, FrameParam.MODE) != 1) revert BadFrame();
        if (_frameParam(0, FrameParam.ALLOWED_SCOPE) != 2) revert BadFrame();
        if (address(uint160(_frameParam(0, FrameParam.RESOLVED_TARGET))) != trader) revert BadFrame();

        // Frame 2: the take SENDER frame.
        if (address(uint160(_frameParam(2, FrameParam.RESOLVED_TARGET))) != address(this)) revert BadFrame();
        if (_frameParam(2, FrameParam.MODE) != 2) revert BadFrame();
        if (bytes4(_frameDataLoad(0, 2)) != this.take.selector) revert BadFrame();
        if (uint256(_frameDataLoad(4, 2)) != uint256(s)) revert BadFrame();
        if (uint256(_frameDataLoad(36, 2)) != uint256(minOut)) revert BadFrame();
        if (_frameParam(2, FrameParam.VALUE) != uint256(amountIn)) revert BadFrame();

        // Optional frame 3: assertFilled.
        if (frameCount == 4) {
            if (address(uint160(_frameParam(3, FrameParam.RESOLVED_TARGET))) != address(this)) revert BadFrame();
            if (_frameParam(3, FrameParam.MODE) != 1) revert BadFrame();
            if (_frameParam(3, FrameParam.ALLOWED_SCOPE) != 0) revert BadFrame();
            if (bytes4(_frameDataLoad(0, 3)) != this.assertFilled.selector) revert BadFrame();
        }

        if (amountIn < minTrade || amountIn > sizeLeft) revert BadSize();
        if (uint256(amountIn) * uint256(price) < uint256(minOut)) revert BadPrice();
        if (_txParam(TxParam.MAX_PRIORITY_FEE_PER_GAS) > maxPriorityFee) revert BadFee();
        if (_txParam(TxParam.MAX_FEE) > maxFee) revert BadFee();
        for (uint256 i = 0; i < frameCount; i++) {
            if (_frameParam(i, FrameParam.EXECUTION_GAS_LIMIT) > maxExecutionGas) revert BadGas();
        }

        _approve(Scope.PAYMENT);
    }

    /// The trade's SENDER frame. Re-checks the pay frame and settles the token leg.
    function take(uint64 s, uint128 minOut) external payable {
        _take(s, minOut);
    }

    function _take(uint64 s, uint128 minOut) internal {
        if (lastSeq != s) revert Stale();
        if (quoteBlock != block.number) revert NotThisBlock();
        if (_txParam(TxParam.CURRENT_FRAME_INDEX) != 2) revert BadFrame();
        if (taken[s]) revert AlreadyTaken();

        if (address(uint160(_frameParam(1, FrameParam.RESOLVED_TARGET))) != address(this)) revert BadFrame();
        if (_frameParam(1, FrameParam.MODE) != 1) revert BadFrame();
        if (_frameParam(1, FrameParam.ALLOWED_SCOPE) != 1) revert BadFrame();
        if (_frameParam(1, FrameParam.STATUS) != 1) revert BadFrame();
        if (bytes4(_frameDataLoad(0, 1)) != this.validateTake.selector) revert BadFrame();
        if (uint256(_frameDataLoad(4, 1)) != uint256(s)) revert BadFrame();
        if (uint256(_frameDataLoad(36, 1)) != uint256(msg.value)) revert BadFrame();
        if (uint256(_frameDataLoad(68, 1)) != uint256(minOut)) revert BadFrame();

        if (msg.value < minTrade || msg.value > sizeLeft) revert BadSize();
        uint256 out = (uint256(msg.value) * uint256(price)) / 1e18;
        if (out < minOut) revert BadPrice();

        taken[s] = true;
        sizeLeft -= uint128(msg.value);
        if (!token.transfer(msg.sender, out)) revert TransferFailed();
        emit Taken(s, msg.sender, msg.value, out);
    }

    function assertFilled() external view {
        _assertFilled();
    }

    function _assertFilled() internal view {
        if (_frameParam(2, FrameParam.STATUS) != 1) revert NotFilled();
    }

    function stake(uint32 delay) external payable onlyMaker {
        IStakingRegistry(stakingRegistry).addStake{value: msg.value}(delay);
    }

    function withdraw() external onlyMaker {
        (bool ok,) = maker.call{value: address(this).balance}("");
        if (!ok) revert TransferFailed();
    }

    // Wrappers so a test harness can replace the frame-introspection opcodes.
    function _txParam(TxParam param) internal view virtual returns (uint256) {
        return txparam(param);
    }

    function _frameParam(uint256 frameIndex, FrameParam param) internal view virtual returns (uint256) {
        return frameparam(frameIndex, param);
    }

    function _frameDataLoad(uint256 offset, uint256 frameIndex) internal view virtual returns (bytes32) {
        return framedataload(offset, frameIndex);
    }

    function _approve(Scope scope) internal virtual {
        approve(scope);
    }
}
