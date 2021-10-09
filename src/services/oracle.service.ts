/* Imports: External */
import axios from 'axios'
import { Contract, Signer } from 'ethers'
import { JsonRpcProvider } from '@ethersproject/providers'
import {
  sleep,
  loadContract,
  loadContractFromManager,
  L1ProviderWrapper,
  L2ProviderWrapper,
} from '../utils'
import {
  TransactionBatchProof,
} from '../types/ovm.types'

/* Imports: Internal */
import { BaseService } from './base.service'

interface OracleOptions {
  // Providers for interacting with L1 and L2.
  l1RpcProvider: JsonRpcProvider
  l2RpcProvider: JsonRpcProvider
  l1Wallet: Signer
  pollingInterval: number
  l1StartOffset: number
}

export class OracleService extends BaseService<OracleOptions> {
  protected name = 'Oracle'
  protected defaultOptions = {
    pollingInterval: 5000,
    l1StartOffset: 25678980,
  }
  private instance: any

  private state: {
    l1Provider: L1ProviderWrapper
    l2Provider: L2ProviderWrapper
    Lib_AddressManager: Contract
    OVM_StateCommitmentChain: Contract
    OVM_CanonicalTransactionChain: Contract
    OVM_FraudVerifier: Contract
    OVM_ExecutionManager: Contract
  }

  protected async _init(): Promise<void> {
    this.state = {} as any

    const address = await this.options.l1Wallet.getAddress()
    this.logger.info('Using L1 EOA', { address })

    this.logger.info('Trying to connect to the L1 network...')
    for (let i = 0; i < 10; i++) {
      try {
        await this.options.l1RpcProvider.detectNetwork()
        this.logger.info('Successfully connected to the L1 network.')
        break
      } catch (err) {
        if (i < 9) {
          this.logger.info('Unable to connect to L1 network', {
            retryAttemptsRemaining: 10 - i,
          })
          await sleep(1000)
        } else {
          throw new Error(
            `Unable to connect to the L1 network, check that your L1 endpoint is correct.`
          )
        }
      }
    }

    this.logger.info('Trying to connect to the L2 network...')
    for (let i = 0; i < 10; i++) {
      try {
        await this.options.l2RpcProvider.detectNetwork()
        this.logger.info('Successfully connected to the L2 network.')
        break
      } catch (err) {
        if (i < 9) {
          this.logger.info('Unable to connect to L1 network', {
            retryAttemptsRemaining: 10 - i,
          })
          await sleep(1000)
        } else {
          throw new Error(
            `Unable to connect to the L2 network, check that your L2 endpoint is correct.`
          )
        }
      }
    }

    this.state.l2Provider = new L2ProviderWrapper(this.options.l2RpcProvider)

    this.logger.info('Connecting to Lib_AddressManager...')
    // const addressManagerAddress = await this.state.l2Provider.getAddressManagerAddress() // TODO: get AddressManager contract address from layer 2.
    this.state.Lib_AddressManager = loadContract(
      'Lib_AddressManager',
      '0x100Dd3b414Df5BbA2B542864fF94aF8024aFdf3a',
      this.options.l1RpcProvider
    )
    this.logger.info('Connected to Lib_AddressManager', {
      address: this.state.Lib_AddressManager.address,
    })

    this.logger.info('Connecting to OVM_StateCommitmentChain...')
    this.state.OVM_StateCommitmentChain = await loadContractFromManager(
      'OVM_StateCommitmentChain',
      this.state.Lib_AddressManager,
      this.options.l1RpcProvider
    )
    this.logger.info('Connected to OVM_StateCommitmentChain', {
      address: this.state.OVM_StateCommitmentChain.address,
    })

    this.logger.info('Connecting to OVM_CanonicalTransactionChain...')
    this.state.OVM_CanonicalTransactionChain = await loadContractFromManager(
      'OVM_CanonicalTransactionChain',
      this.state.Lib_AddressManager,
      this.options.l1RpcProvider
    )
    this.logger.info('Connected to OVM_CanonicalTransactionChain', {
      address: this.state.OVM_CanonicalTransactionChain.address,
    })

    this.logger.info('Connecting to OVM_FraudVerifier...')
    this.state.OVM_FraudVerifier = await loadContractFromManager(
      'OVM_FraudVerifier',
      this.state.Lib_AddressManager,
      this.options.l1RpcProvider
    )
    this.logger.info('Connected to OVM_FraudVerifier', {
      address: this.state.OVM_FraudVerifier.address,
    })

    this.logger.info('Connecting to OVM_ExecutionManager...')
    this.state.OVM_ExecutionManager = await loadContractFromManager(
      'OVM_ExecutionManager',
      this.state.Lib_AddressManager,
      this.options.l1RpcProvider
    )
    this.logger.info('Connected to OVM_ExecutionManager', {
      address: this.state.OVM_ExecutionManager.address,
    })

    this.logger.info('Connected to all contracts.')

    this.state.l1Provider = new L1ProviderWrapper(
      this.options.l1RpcProvider,
      this.state.OVM_StateCommitmentChain,
      this.state.OVM_CanonicalTransactionChain,
      this.state.OVM_ExecutionManager,
      this.options.l1StartOffset,
      0
    )

    this.instance = axios.create({
      baseURL: "http://127.0.0.1:3000"
    })
  }

  protected async _start(): Promise<void> {
    const l1LatestBlock = await this.state.l1Provider.provider.getBlockNumber()
    const l2LatestBlock = await this.state.l2Provider.provider.getBlockNumber()

    let l2TxIndex = l2LatestBlock - 1
    while (this.running) {
      await sleep(this.options.pollingInterval)
      this.logger.info('Start to find transaction proof', {
        'l2-tx-index': l2TxIndex
      })

      try {
        const transactionProof = await this.state.l1Provider.getTransactionBatchProof(
          l2TxIndex,
          l1LatestBlock - 100
        )
        this._feed(l2TxIndex, transactionProof)

        l2TxIndex++
      } catch (err) {
        // console.log(err.stack);
      }
    }
  }

  async _feed (index: number, proof: any): Promise<void> {
    proof.id = index

    await this.instance.post('proofs', proof)
    this.logger.info('Put transaction proof to db.json', {
      index: index
    })
  }
}
