// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import { ERC4626, ERC20 } from '@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol';

contract OpenzeppelinERC4626 is ERC4626 {
  constructor(
    ERC20 _underlying,
    string memory _name,
    string memory _symbol
  ) ERC4626(_underlying) ERC20(_name, _symbol) {}
}
