const { expect } = require('chai')
const { ethers } = require('hardhat')
const { parseUnits, formatUnits } = ethers
const { time, mine } = require('@nomicfoundation/hardhat-network-helpers')
const utils = require('./utils')

describe('[CustomXERC4626]', () => {
  let deployer, user1
  let contract
  let token

  before(async () => {
    [deployer, user1] = await ethers.getSigners()

    const initialBalance = parseUnits('2', 18)
    ;[token] = await utils.setupTokens(initialBalance)
    await token.transfer(user1.address, parseUnits('1', 18))

    const timestamp = BigInt(await time.latest())
    const sharesFactory = await ethers.getContractFactory('CustomXERC4626')
    // 10 minutes
    const rewardsCycleLength = 10n * 60n
    contract = await sharesFactory.deploy(
      token.target,
      'ERC20Name',
      'ERC20Symbol',
      rewardsCycleLength
    )
    const rewardsCycleEnd = await contract.rewardsCycleEnd()
    expect(rewardsCycleEnd).to.be.lte(timestamp)

    console.log('deployer:', deployer.address)
    console.log('user1:', user1.address)
    console.log('CustomXERC4626:', contract.target)
    console.log('token:', token.target)

    await utils.printBalances({ deployer, user1, contract }, { token })
  })

  describe('1. [setups]', () => {
    it('1.1 contracts have been deployed', () => {
      expect(contract.target).to.be.exist
      expect(token.target).to.be.exist
    })

    it('1.2 users should have token balance', async () => {
      const balance1 = await token.balanceOf(user1.address)
      expect(balance1).to.be.equal(parseUnits('1', 18))
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

    it('1.5 should have rewardsCycleLength', async () => {
      const rewardsCycleLength = await contract.rewardsCycleLength()
      expect(rewardsCycleLength).to.be.equal(10n * 60n)
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

  describe('3. [reward]', () => {
    const amountIn = parseUnits('1', 18)
    const reward = parseUnits('0.1', 18)
    let shares

    before(async () => {
      shares = await contract.maxRedeem(user1.address)
    })

    afterEach(async () => {
      await utils.printBalances(
        { deployer, user1, contract },
        { token },
        { skipETH: true }
      )
    })

    it('3.1 add rewards to pool will not change totalAssets', async () => {
      await token.mint(contract.target, reward)

      expect(await contract.lastRewardAmount()).to.be.equal(0n)
      expect(await contract.totalAssets()).to.be.equal(amountIn)
      expect(await contract.convertToAssets(shares)).to.be.equal(amountIn)
      expect(await contract.lastSync()).to.be.equal(0n)
      // contract token balance is 1.1, but totalAssets is still 1
      expect(await token.balanceOf(contract.target)).to.be.equal(
        amountIn + reward
      )
    })

    it('3.2 after sync, lastSync, lastRewardAmount & rewardsCycleEnd will be updated', async () => {
      const rewardsCycleEndBefore = await contract.rewardsCycleEnd()

      await contract.syncRewards()

      expect(await contract.lastRewardAmount()).to.be.equal(reward)
      expect(await contract.totalAssets()).to.be.equal(amountIn)
      expect(await contract.convertToAssets(shares)).to.be.equal(amountIn)
      expect(await contract.lastSync()).to.be.gt(0n)
      // contract token balance is 1.1, but totalAssets is still 1
      expect(await token.balanceOf(contract.target)).to.be.equal(
        amountIn + reward
      )
      const rewardsCycleEndAfter = await contract.rewardsCycleEnd()
      expect(rewardsCycleEndAfter).to.be.gt(rewardsCycleEndBefore)
      console.log({
        rewardsCycleEndBefore: new Date(
          +rewardsCycleEndBefore.toString() * 1000
        ).toLocaleString(),
        rewardsCycleEndAfter: new Date(
          +rewardsCycleEndAfter.toString() * 1000
        ).toLocaleString()
      })
    })

    it('3.3 accrue part of the rewards', async () => {
      const userAssetsBefore = await contract.convertToAssets(shares)

      const blockTimestamp = BigInt(await time.latest())
      const rewardsCycleEnd = await contract.rewardsCycleEnd()
      await time.setNextBlockTimestamp(
        blockTimestamp + (rewardsCycleEnd - blockTimestamp) / 2n
      )
      await mine(1)

      console.log({
        lastSync: new Date(
          +(await contract.lastSync()).toString() * 1000
        ).toLocaleString(),
        blockTimestamp: new Date((await time.latest()) * 1000).toLocaleString(),
        rewardsCycleEnd: new Date(
          +(await contract.rewardsCycleEnd()).toString() * 1000
        ).toLocaleString()
      })

      expect(await contract.lastRewardAmount()).to.be.equal(reward)

      const totalAssets = await contract.totalAssets()
      expect(totalAssets).to.be.gt(amountIn)
      expect(totalAssets).to.be.lt(amountIn + reward)

      const userAssetsAfter = await contract.convertToAssets(shares)
      expect(userAssetsAfter).to.be.gt(amountIn)
      expect(userAssetsAfter).to.be.lt(amountIn + reward)
      console.log({
        userAssetsBefore: formatUnits(userAssetsBefore, 18),
        userAssetsAfter: formatUnits(userAssetsAfter, 18)
      })
    })

    it('3.4 accrue all of the remaining rewards', async () => {
      const userAssetsBefore = await contract.convertToAssets(shares)

      const rewardsCycleEnd = await contract.rewardsCycleEnd()
      await time.setNextBlockTimestamp(rewardsCycleEnd + 1n)
      await mine(1)

      console.log({
        lastSync: new Date(
          +(await contract.lastSync()).toString() * 1000
        ).toLocaleString(),
        blockTimestamp: new Date((await time.latest()) * 1000).toLocaleString(),
        rewardsCycleEnd: new Date(
          +(await contract.rewardsCycleEnd()).toString() * 1000
        ).toLocaleString()
      })

      expect(await contract.lastRewardAmount()).to.be.equal(reward)

      const totalAssets = await contract.totalAssets()
      console.log({ totalAssets })
      expect(totalAssets).to.be.gt(amountIn)
      expect(totalAssets).to.be.eq(amountIn + reward)

      const userAssetsAfter = await contract.convertToAssets(shares)
      expect(userAssetsAfter).to.be.gt(userAssetsBefore)
      expect(userAssetsAfter).to.be.eq(amountIn + reward)
      console.log({
        userAssetsBefore: formatUnits(userAssetsBefore, 18),
        userAssetsAfter: formatUnits(userAssetsAfter, 18)
      })
    })
  })

  describe('4. [redeem]', () => {
    afterEach(async () => {
      await utils.printBalances(
        { deployer, user1, contract },
        { token },
        { skipETH: true }
      )
    })

    it('4.1 user can redeem half of the shares', async () => {
      const totalShares = await contract.maxRedeem(user1.address)
      const balanceBefore = await token.balanceOf(user1.address)

      await contract
        .connect(user1)
        .redeem(totalShares / 2n, user1.address, user1.address)

      const sharesAfter = await contract.maxRedeem(user1.address)
      expect(sharesAfter).to.be.lt(totalShares)

      const balanceAfter = await token.balanceOf(user1.address)
      expect(balanceAfter).to.be.gt(balanceBefore)

      await utils.printBalances(
        { deployer, user1, contract },
        { token },
        { skipETH: true }
      )
    })

    it('4.2 user can redeem all remaining shares', async () => {
      await contract.syncRewards()

      const sharesBefore = await contract.maxRedeem(user1.address)

      await contract
        .connect(user1)
        .redeem(sharesBefore, user1.address, user1.address)

      const sharesAfter = await contract.maxRedeem(user1.address)
      expect(sharesAfter).to.be.equal(0n)

      const balance = await token.balanceOf(user1.address)
      expect(balance).to.be.equal(parseUnits('1.1', 18))
    })
  })
})
