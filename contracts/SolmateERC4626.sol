// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import { ERC4626, ERC20 } from 'solmate/src/mixins/ERC4626.sol';

contract SolmateERC4626 is ERC4626 {
  constructor(
    ERC20 _underlying,
    string memory _name,
    string memory _symbol
  ) ERC4626(_underlying, _name, _symbol) {}

  function totalAssets() public view override returns (uint256) {
    return asset.balanceOf(address(this));
  }
}
