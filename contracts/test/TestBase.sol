// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface Vm {
    function prank(address) external;
    function startPrank(address) external;
    function stopPrank() external;
    function warp(uint256) external;
    function roll(uint256) external;
    function deal(address, uint256) external;
    function expectRevert(bytes4) external;
    function expectRevert(bytes calldata) external;
}

abstract contract TestBase {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function assertEq(uint256 a, uint256 b) internal pure {
        require(a == b, "assertEq");
    }

    function assertEq(address a, address b) internal pure {
        require(a == b, "assertEq");
    }

    function assertTrue(bool value) internal pure {
        require(value, "assertTrue");
    }
}
