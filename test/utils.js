const { ethers } = require('hardhat')
const { formatUnits } = ethers

async function setupTokens (initialBalance = 2n ** 256n - 1n) {
  const tokenFactory = await ethers.getContractFactory('CustomERC20')
  const tokenA = await tokenFactory.deploy('Token0 Name', 'Token0')
  const tokenB = await tokenFactory.deploy('Token1 Name', 'Token1')
  const [signer] = await ethers.getSigners()
  await tokenA.mint(signer.address, initialBalance)
  await tokenB.mint(signer.address, initialBalance)
  return [tokenA, tokenB].sort((tokenA, tokenB) =>
    tokenA.target.toLowerCase() < tokenB.target.toLowerCase() ? -1 : 1
  )
}

async function fetchBalances (contract, tokens) {
  const balance = {}
  balance.ETH = await ethers.provider.getBalance(
    contract.address || contract.target
  )
  for (const name in tokens) {
    balance[name] = await fetchBalance(contract, tokens[name])
  }
  return balance
}

async function fetchBalance (contract, token) {
  return token.balanceOf(contract.address || contract.target)
}

async function printBalance (balance, name, tokens) {
  for (const sym in balance) {
    if (sym === 'ETH') {
      console.log(`[${name}] ${sym}:`, formatUnits(balance[sym], 18))
    } else {
      const decimals = await tokens[sym].decimals()
      console.log(`[${name}] ${sym}:`, formatUnits(balance[sym], decimals))
    }
  }
}

async function printBalances (contracts, tokens, opts = {}) {
  console.log(`\n---${opts.context ? ' ' + opts.context : ''} balances ---`)
  for (const key in contracts) {
    const balance = await fetchBalances(contracts[key], tokens)
    await printBalance(balance, key, tokens)
  }
  console.log()
}

module.exports = {
  setupTokens,
  printBalances
}
