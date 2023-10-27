const { expect } = require('chai')
const { ethers } = require('hardhat')
const { parseUnits } = ethers
const utils = require('./utils')

describe('[CustomXERC4626]', () => {
  let deployer, user1, user2
  let contract
  let token

  before(async () => {
    [deployer, user1, user2] = await ethers.getSigners()

    const initialBalance = parseUnits('2', 18)
    ;[token] = await utils.setupTokens(initialBalance)
    await token.transfer(user1.address, parseUnits('1', 18))
    await token.transfer(user2.address, parseUnits('1', 18))

    const sharesFactory = await ethers.getContractFactory('CustomXERC4626')
    const rewardsCycleLength = 1000
    contract = await sharesFactory.deploy(
      token.target,
      'ERC20Name',
      'ERC20Symbol',
      rewardsCycleLength
    )

    console.log('deployer:', deployer.address)
    console.log('user1:', user1.address)
    console.log('user2:', user2.address)
    console.log('CustomXERC4626:', contract.target)
    console.log('token:', token.target)

    await utils.printBalances({ deployer, user1, user2, contract }, { token })
  })

  describe('1. [setups]', () => {
    it('1.1 contracts have been deployed', () => {
      expect(contract.target).to.be.exist
      expect(token.target).to.be.exist
    })

    it('1.2 users should have token balance', async () => {
      const balance1 = await token.balanceOf(user1.address)
      const balance2 = await token.balanceOf(user2.address)
      expect(balance1).to.be.equal(parseUnits('1', 18))
      expect(balance2).to.be.equal(parseUnits('1', 18))
    })

    it('1.3 shares contract should have basic token info', async () => {
      expect(await contract.name()).to.be.equal('ERC20Name')
      expect(await contract.symbol()).to.be.equal('ERC20Symbol')
      expect(await contract.decimals()).to.be.equal(18)

      const underlyingTokenAddr = await contract.asset()
      expect(underlyingTokenAddr).to.be.equal(token.target)
    })

    it('1.4 shares contract should have 0 assets', async () => {
      expect(await contract.totalAssets()).to.be.equal(0)
    })
  })
})
