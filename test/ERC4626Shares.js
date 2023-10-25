const { expect } = require('chai')
const { ethers } = require('hardhat')
const { parseUnits, formatUnits } = ethers
const utils = require('./utils')

describe('ERC4626Shares', () => {
  let deployer
  let shares
  let token

  before('before all', async () => {
    [deployer] = await ethers.getSigners()

    const initialBalance = parseUnits('1', 18)
    ;[token] = await utils.setupTokens(initialBalance)

    const sharesFactory = await ethers.getContractFactory('ERC4626Shares')
    shares = await sharesFactory.deploy(token.target, 'Name', 'Symbol')

    console.log('deployer:', deployer.address)
    console.log('ERC4626Shares:', shares.target)

    console.log('token:', token.target)

    await utils.printBalances({ deployer, shares }, { token })
  })

  describe('1. contract setups', () => {
    it('1.1 contracts have been deployed', () => {
      expect(shares.target).to.be.exist
      expect(token.target).to.be.exist
    })
  })
})
