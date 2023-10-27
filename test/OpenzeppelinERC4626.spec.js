const { expect } = require('chai')
const { ethers } = require('hardhat')
const { parseUnits, formatUnits } = ethers
const utils = require('./utils')

describe('[ERC4626]', () => {
  let deployer, user1, user2
  let contract
  let token

  before(async () => {
    [deployer, user1, user2] = await ethers.getSigners()

    const initialBalance = parseUnits('2', 18)
    ;[token] = await utils.setupTokens(initialBalance)
    await token.transfer(user1.address, parseUnits('1', 18))
    await token.transfer(user2.address, parseUnits('1', 18))

    const sharesFactory = await ethers.getContractFactory('OpenzeppelinERC4626')
    contract = await sharesFactory.deploy(
      token.target,
      'ERC20Name',
      'ERC20Symbol'
    )

    console.log('deployer:', deployer.address)
    console.log('user1:', user1.address)
    console.log('user2:', user2.address)
    console.log('OpenzeppelinERC4626:', contract.target)
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

  describe('2. [deposit]', () => {
    const amountIn = parseUnits('1', 18)

    it('2.1 initial share of a user should be 0', async () => {
      const shares = await contract.maxRedeem(user1.address)
      expect(shares).to.be.equal(0n)
    })

    it('2.2 user can deposit token', async () => {
      const expectedShares = await contract.convertToShares(amountIn)
      expect(expectedShares).to.be.equal(amountIn)

      await token.connect(user1).approve(contract.target, amountIn)
      await contract.connect(user1).deposit(amountIn, user1.address)
      const shares = await contract.maxRedeem(user1.address)
      expect(shares).to.be.equal(expectedShares)
    })

    it('2.3 contract should have underlying assets after user deposit', async () => {
      expect(await contract.totalAssets()).to.be.equal(amountIn)
    })
  })

  describe('3. [redeem]', () => {
    it('3.1 user can redeem token', async () => {
      const shares = await contract.maxRedeem(user1.address)
      const expectedAssets = await contract.convertToAssets(shares)
      expect(expectedAssets).to.be.equal(parseUnits('1', 18))

      await contract.connect(user1).redeem(shares, user1.address, user1.address)

      const sharesAfter = await contract.maxRedeem(user1.address)
      expect(sharesAfter).to.be.equal(0n)

      const balance = await token.balanceOf(user1.address)
      expect(balance).to.be.equal(expectedAssets)
    })
  })

  describe('4. [multi-user]', () => {
    before(async () => {
      await utils.printBalances(
        { user1, user2, contract },
        { token },
        { skipETH: true }
      )
    })

    afterEach(async () => {
      await utils.printBalances(
        { user1, user2, contract },
        { token },
        { skipETH: true }
      )
    })

    it('4.1 deposit token', async () => {
      const amountIn = parseUnits('1', 18)
      await token.connect(user1).approve(contract.target, amountIn)
      await contract.connect(user1).deposit(amountIn, user1.address)
      await token.connect(user2).approve(contract.target, amountIn)
      await contract.connect(user2).deposit(amountIn, user2.address)

      const shares1 = await contract.maxRedeem(user1.address)
      const shares2 = await contract.maxRedeem(user2.address)
      expect(shares1).to.be.equal(amountIn)
      expect(shares2).to.be.equal(amountIn)

      const totalAssets = await contract.totalAssets()
      expect(totalAssets).to.be.equal(amountIn * 2n)
    })

    it('4.1 user1 redeems 1/2 shares', async () => {
      const totalShares = await contract.maxRedeem(user1.address)
      const redeemShares = totalShares / 2n
      await contract
        .connect(user1)
        .redeem(redeemShares, user1.address, user1.address)

      const sharesAfter = await contract.maxRedeem(user1.address)
      expect(sharesAfter).to.be.equal(totalShares - redeemShares)

      const balance = await token.balanceOf(user1.address)
      expect(balance).to.be.equal(parseUnits('0.5', 18))
    })

    it('4.2 user2 redeems 1/5 shares', async () => {
      const totalShares = await contract.maxRedeem(user2.address)
      const redeemShares = totalShares / 5n
      await contract
        .connect(user2)
        .redeem(redeemShares, user2.address, user2.address)

      const sharesAfter = await contract.maxRedeem(user2.address)
      expect(sharesAfter).to.be.equal(totalShares - redeemShares)

      const balance = await token.balanceOf(user2.address)
      expect(balance).to.be.equal(parseUnits('0.2', 18))
    })

    it('4.3 user1 redeems all shares', async () => {
      const totalShares = await contract.maxRedeem(user1.address)
      await contract
        .connect(user1)
        .redeem(totalShares, user1.address, user1.address)

      const sharesAfter = await contract.maxRedeem(user1.address)
      expect(sharesAfter).to.be.equal(0n)

      const balance = await token.balanceOf(user1.address)
      expect(balance).to.be.equal(parseUnits('1', 18))
    })

    it('4.4 user2 redeems all shares', async () => {
      const totalShares = await contract.maxRedeem(user2.address)
      await contract
        .connect(user2)
        .redeem(totalShares, user2.address, user2.address)

      const sharesAfter = await contract.maxRedeem(user2.address)
      expect(sharesAfter).to.be.equal(0n)

      const balance = await token.balanceOf(user2.address)
      expect(balance).to.be.equal(parseUnits('1', 18))
    })
  })
})
