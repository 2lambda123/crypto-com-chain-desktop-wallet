import { Bytes } from '@crypto-com/chain-jslib/lib/dist/utils/bytes/bytes';

import sdk from '@crypto-com/chain-jslib';
import { Big, Units } from '../types/ChainJsLib';
import { WalletConfig } from '../../config/StaticConfig';
import {
  TransactionUnsigned,
  DelegateTransactionUnsigned,
  TransferTransactionUnsigned,
  WithdrawStakingRewardUnsigned,
} from './TransactionSupported';
import { ISignerProvider } from './SignerProvider';

export interface ITransactionSigner {
  signTransfer(transaction: TransferTransactionUnsigned, phrase: string): Promise<string>;

  signDelegateTx(transaction: DelegateTransactionUnsigned, phrase: string): Promise<string>;

  signWithdrawStakingRewardTx(
    transaction: WithdrawStakingRewardUnsigned,
    phrase: string,
  ): Promise<string>;
}

export class TransactionSigner implements ITransactionSigner {
  public readonly config: WalletConfig;

  public readonly signerProvider: ISignerProvider;

  constructor(config: WalletConfig, signerProvider: ISignerProvider) {
    this.config = config;
    this.signerProvider = signerProvider;
  }

  public getTransactionInfo(phrase: string, transaction: TransactionUnsigned) {
    const cro = sdk.CroSDK({ network: this.config.network });
    const rawTx = new cro.RawTransaction();
    rawTx.setMemo(transaction.memo);
    return { cro, rawTx };
  }

  public async signTransfer(
    transaction: TransferTransactionUnsigned,
    phrase: string,
  ): Promise<string> {
    const { cro, rawTx } = this.getTransactionInfo(phrase, transaction);

    const msgSend = new cro.bank.MsgSend({
      fromAddress: transaction.fromAddress,
      toAddress: transaction.toAddress,
      amount: new cro.Coin(transaction.amount, Units.BASE),
    });

    const signableTx = rawTx
      .appendMessage(msgSend)
      .addSigner({
        publicKey: await this.signerProvider.getPubKey(),
        accountNumber: new Big(transaction.accountNumber),
        accountSequence: new Big(transaction.accountSequence),
      })
      .toSignable();

    const signature = await this.signerProvider.sign(signableTx.toSignDoc(0));

    return signableTx
      .setSignature(0, signature)
      .toSigned()
      .getHexEncoded();
  }

  public async signDelegateTx(
    transaction: DelegateTransactionUnsigned,
    phrase: string,
  ): Promise<string> {
    const { cro, rawTx } = this.getTransactionInfo(phrase, transaction);

    const delegateAmount = new cro.Coin(transaction.amount, Units.BASE);
    const msgDelegate = new cro.staking.MsgDelegate({
      delegatorAddress: transaction.delegatorAddress,
      validatorAddress: transaction.validatorAddress,
      amount: delegateAmount,
    });

    let fee = { amount: [{ amount: '0', denom: Units.BASE }], gas: '2000000' };
    let value = {
      amount: { amount: transaction.amount, denom: Units.BASE },
      delegator_address: transaction.delegatorAddress,
      validator_address: transaction.validatorAddress,
    };
    let msg = { type: 'cosmos-sdk/MsgDelegate', value: value };

    let rawMessage = {
      account_number: transaction.accountNumber.toString(),
      chain_id: 'testnet',
      fee: fee,
      memo: '',
      msgs: [msg],
      sequence: transaction.accountSequence,
    };

    const signableTx = rawTx
      .appendMessage(msgDelegate)
      .addSigner({
        publicKey: await this.signerProvider.getPubKey(),
        accountNumber: new Big(transaction.accountNumber),
        accountSequence: new Big(transaction.accountSequence),
      })
      .toSignable();

    const signature = await this.signerProvider.sign(signableTx.toSignDoc(0));

    return signableTx
      .setSignature(0, signature)
      .toSigned()
      .getHexEncoded();
  }

  public async signWithdrawStakingRewardTx(
    transaction: WithdrawStakingRewardUnsigned,
    phrase: string,
  ): Promise<string> {
    const { cro, rawTx } = this.getTransactionInfo(phrase, transaction);

    const msgWithdrawDelegatorReward = new cro.distribution.MsgWithdrawDelegatorReward({
      delegatorAddress: transaction.delegatorAddress,
      validatorAddress: transaction.validatorAddress,
    });

    const signableTx = rawTx
      .appendMessage(msgWithdrawDelegatorReward)
      .addSigner({
        publicKey: await this.signerProvider.getPubKey(),
        accountNumber: new Big(transaction.accountNumber),
        accountSequence: new Big(transaction.accountSequence),
      })
      .toSignable();
    const signature = await this.signerProvider.sign(signableTx.toSignDoc(0));
    return signableTx
      .setSignature(0, signature)
      .toSigned()
      .getHexEncoded();
  }
}
