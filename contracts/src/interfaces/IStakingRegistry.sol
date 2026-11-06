// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IStakingRegistry {
    function addStake(uint32 unstakeDelaySec) external payable;
}
