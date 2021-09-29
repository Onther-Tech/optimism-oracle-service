import { Wallet } from 'ethers'
import { JsonRpcProvider } from '@ethersproject/providers'
import { OracleService } from '../services/oracle.service'
import { config } from 'dotenv'
config()

const env = process.env
const L2_NODE_WEB3_URL = env.L2_NODE_WEB3_URL
const L1_NODE_WEB3_URL = env.L1_NODE_WEB3_URL
const L1_WALLET_KEY = env.L1_WALLET_KEY
const POLLING_INTERVAL = env.POLLING_INTERVAL || '5000'
const L1_START_OFFSET = env.L1_START_OFFSET || '0'

const main = async () => {
  const l2Provider = new JsonRpcProvider(L2_NODE_WEB3_URL)
  const l1Provider = new JsonRpcProvider(L1_NODE_WEB3_URL)

  let wallet: Wallet
  if (L1_WALLET_KEY) {
    wallet = new Wallet(L1_WALLET_KEY, l1Provider)
  } else {
    throw new Error('Must pass one of L1_PRIVATE_KEY or MNEMONIC')
  }

  const service = new OracleService({
    l1RpcProvider: l1Provider,
    l2RpcProvider: l2Provider,
    l1Wallet: wallet,
    pollingInterval: parseInt(POLLING_INTERVAL, 10),
    l1StartOffset: parseInt(L1_START_OFFSET, 10)
  })

  await service.start()
}
export default main