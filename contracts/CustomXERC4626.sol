// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import { ERC20, ERC4626, xERC4626 } from './lib/xERC4626/xERC4626.sol';

contract CustomXERC4626 is xERC4626 {
  constructor(
    ERC20 _underlying,
    string memory _name,
    string memory _symbol,
    uint32 _rewardsCycleLength
  ) ERC4626(_underlying, _name, _symbol) xERC4626(_rewardsCycleLength) {}
}
