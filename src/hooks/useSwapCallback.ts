import { BigNumber } from '@ethersproject/bignumber';
import { Contract } from '@ethersproject/contracts';
import { TransactionResponse } from '@ethersproject/providers';
import {
  JSBI,
  Percent,
  Router,
  SwapParameters,
  Trade,
  TradeType,
} from '@uniswap/sdk';
import { useMemo } from 'react';
import { ethers } from 'ethers';
import {
  BIPS_BASE,
  INITIAL_ALLOWED_SLIPPAGE,
  DEFAULT_DEADLINE_FROM_NOW,
  ROUTER_ADDRESS,
  domainType1,
} from 'constants/index';
import routerABI from 'constants/abis/meta-router-v2.json';
import { useTransactionAdder } from 'state/transactions/hooks';
import {
  calculateGasMargin,
  getRouterContract,
  isZero,
  isAddress,
  shortenAddress,
} from 'utils';
import { useActiveWeb3React } from 'hooks';
import useTransactionDeadline from './useTransactionDeadline';
import useENS from './useENS';
import { Version } from './useToggledVersion';
import { splitSignature } from '@ethersproject/bytes';
import { useIsGaslessEnabled } from 'state/application/hooks';
import { useBiconomy } from 'context/Biconomy';

export enum SwapCallbackState {
  INVALID,
  LOADING,
  VALID,
}

interface SwapCall {
  contract: Contract;
  parameters: SwapParameters;
}

interface SuccessfulCall {
  call: SwapCall;
  gasEstimate: BigNumber;
}

interface FailedCall {
  call: SwapCall;
  error: Error;
}

type EstimatedSwapCall = SuccessfulCall | FailedCall;

/**
 * Returns the swap calls that can be used to make the trade
 * @param trade trade to execute
 * @param allowedSlippage user allowed slippage
 * @param recipientAddressOrName
 */
function useSwapCallArguments(
  trade: Trade | undefined, // trade to execute, required
  allowedSlippage: number = INITIAL_ALLOWED_SLIPPAGE, // in bips
  recipientAddressOrName: string | null, // the ENS name or address of the recipient of the trade, or null if swap should be returned to sender
): SwapCall[] {
  const { account, chainId, library } = useActiveWeb3React();

  const { address: recipientAddress } = useENS(recipientAddressOrName);
  const recipient =
    recipientAddressOrName === null ? account : recipientAddress;
  const deadline = useTransactionDeadline();

  return useMemo(() => {
    const tradeVersion = Version.v2;
    if (
      !trade ||
      !recipient ||
      !library ||
      !account ||
      !tradeVersion ||
      !chainId
    )
      return [];

    const contract: Contract | null = getRouterContract(
      chainId,
      library,
      account,
    );
    if (!contract) {
      return [];
    }

    const swapMethods = [];

    switch (tradeVersion) {
      case Version.v2:
        swapMethods.push(
          Router.swapCallParameters(trade, {
            feeOnTransfer: false,
            allowedSlippage: new Percent(
              JSBI.BigInt(allowedSlippage),
              BIPS_BASE,
            ),
            recipient,
            ttl: deadline ? deadline.toNumber() : DEFAULT_DEADLINE_FROM_NOW,
          }),
        );

        if (trade.tradeType === TradeType.EXACT_INPUT) {
          swapMethods.push(
            Router.swapCallParameters(trade, {
              feeOnTransfer: true,
              allowedSlippage: new Percent(
                JSBI.BigInt(allowedSlippage),
                BIPS_BASE,
              ),
              recipient,
              ttl: deadline ? deadline.toNumber() : DEFAULT_DEADLINE_FROM_NOW,
            }),
          );
        }
        break;
    }
    return swapMethods.map((parameters) => ({ parameters, contract }));
  }, [account, allowedSlippage, chainId, deadline, library, recipient, trade]);
}

// returns a function that will execute a swap, if the parameters are all valid
// and the user has approved the slippage adjusted input amount for the trade
export function useSwapCallback(
  trade: Trade | undefined, // trade to execute, required
  allowedSlippage: number = INITIAL_ALLOWED_SLIPPAGE, // in bips
  recipientAddressOrName: string | null, // the ENS name or address of the recipient of the trade, or null if swap should be returned to sender
): {
  state: SwapCallbackState;
  callback:
    | null
    | (() => Promise<{ response: TransactionResponse; summary: string }>);
  error: string | null;
} {
  const { account, chainId, library } = useActiveWeb3React();
  const gaslessMode = useIsGaslessEnabled();

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const { biconomy, isBiconomyReady } = useBiconomy()!;

  const contractAddress = ROUTER_ADDRESS;

  const swapCalls = useSwapCallArguments(
    trade,
    allowedSlippage,
    recipientAddressOrName,
  );

  const addTransaction = useTransactionAdder();

  const { address: recipientAddress } = useENS(recipientAddressOrName);
  const recipient =
    recipientAddressOrName === null ? account : recipientAddress;

  return useMemo(() => {
    if (!trade || !library || !account || !chainId) {
      return {
        state: SwapCallbackState.INVALID,
        callback: null,
        error: 'Missing dependencies',
      };
    }
    if (!recipient) {
      if (recipientAddressOrName !== null) {
        return {
          state: SwapCallbackState.INVALID,
          callback: null,
          error: 'Invalid recipient',
        };
      } else {
        return {
          state: SwapCallbackState.LOADING,
          callback: null,
          error: null,
        };
      }
    }

    const tradeVersion = Version.v2;

    return {
      state: SwapCallbackState.VALID,
      callback: async function onSwap(): Promise<{
        response: TransactionResponse;
        summary: string;
      }> {
        const estimatedCalls: EstimatedSwapCall[] = await Promise.all(
          swapCalls.map((call) => {
            const {
              parameters: { methodName, args, value },
              contract,
            } = call;
            const options = !value || isZero(value) ? {} : { value };

            return contract.estimateGas[methodName](...args, options)
              .then((gasEstimate) => {
                return {
                  call,
                  gasEstimate: gasEstimate.add(100000),
                };
              })
              .catch((gasError) => {
                console.debug(
                  'Gas estimate failed, trying eth_call to extract error',
                  call,
                );

                return contract.callStatic[methodName](...args, options)
                  .then((result) => {
                    console.debug(
                      'Unexpected successful call after failed estimate gas',
                      call,
                      gasError,
                      result,
                    );
                    return {
                      call,
                      error: new Error(
                        'Unexpected issue with estimating the gas. Please try again.',
                      ),
                    };
                  })
                  .catch((callError) => {
                    console.debug('Call threw error', call, callError);
                    let errorMessage: string;
                    switch (callError.reason) {
                      case 'UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT':
                      case 'UniswapV2Router: EXCESSIVE_INPUT_AMOUNT':
                        errorMessage =
                          'This transaction will not succeed either due to price movement or fee on transfer. Try increasing your slippage tolerance.';
                        break;
                      default:
                        errorMessage = `The transaction cannot succeed due to error: ${callError.reason}. This is probably an issue with one of the tokens you are swapping.`;
                    }
                    return { call, error: new Error(errorMessage) };
                  });
              });
          }),
        );

        // a successful estimation is a bignumber gas estimate and the next call is also a bignumber gas estimate
        const successfulEstimation = estimatedCalls.find(
          (el, ix, list): el is SuccessfulCall =>
            'gasEstimate' in el &&
            (ix === list.length - 1 || 'gasEstimate' in list[ix + 1]),
        );

        if (!successfulEstimation) {
          const errorCalls = estimatedCalls.filter(
            (call): call is FailedCall => 'error' in call,
          );
          if (errorCalls.length > 0)
            throw errorCalls[errorCalls.length - 1].error;
          throw new Error(
            'Unexpected error. Please contact support: none of the calls threw an error',
          );
        }

        const {
          call: {
            contract,
            parameters: { methodName, args, value },
          },
          gasEstimate,
        } = successfulEstimation;

        if (
          methodName === 'swapExactETHForTokens' ||
          methodName === 'swapETHForExactTokens' ||
          !gaslessMode
        ) {
          return contract[methodName](...args, {
            gasLimit: calculateGasMargin(gasEstimate),
            ...(value && !isZero(value)
              ? { value, from: account }
              : { from: account }),
          })
            .then((response: TransactionResponse) => {
              const inputSymbol = trade.inputAmount.currency.symbol;
              const outputSymbol = trade.outputAmount.currency.symbol;
              const inputAmount = trade.inputAmount.toSignificant(3);
              const outputAmount = trade.outputAmount.toSignificant(3);

              const base = `Swap ${inputAmount} ${inputSymbol} for ${outputAmount} ${outputSymbol}`;
              const withRecipient =
                recipient === account
                  ? base
                  : `${base} to ${
                      recipientAddressOrName &&
                      isAddress(recipientAddressOrName)
                        ? shortenAddress(recipientAddressOrName)
                        : recipientAddressOrName
                    }`;

              const withVersion =
                tradeVersion === Version.v2
                  ? withRecipient
                  : `${withRecipient} on ${(tradeVersion as any).toUpperCase()}`;

              addTransaction(response, {
                summary: withVersion,
              });

              return { response, summary: withVersion };
            })
            .catch((error: any) => {
              // if the user rejected the tx, pass this along
              if (error?.code === 4001) {
                throw new Error('Transaction rejected.');
              } else {
                // otherwise, the error was unexpected and we need to convey that
                console.error(`Swap failed`, error, methodName, args, value);
                throw new Error(`Swap failed: ${error.message}`);
              }
            });
        } else {
          // handle gasless swap
          //TODO
          //Catch grep error response properly for signer and signature mismatch etc. any other response than 200
          const biconomyContract = new ethers.Contract(
            contractAddress,
            routerABI as any,
            biconomy.getSignerByAddress(account),
          );

          const biconomyContractInterface = new ethers.utils.Interface(
            routerABI,
          );

          const biconomyNonce = parseInt(
            await biconomyContract.getNonce(account),
          );

          const gasLimit = calculateGasMargin(gasEstimate);
          console.log('gasLimit', gasLimit);

          const functionSignature = biconomyContractInterface.encodeFunctionData(
            methodName,
            args,
          );

          const message = {
            nonce: biconomyNonce,
            functionSignature,
            from: account,
          };

          const dataToSign = JSON.stringify({
            types: {
              EIP712Domain: domainType1,
              MetaTransaction: [
                { name: 'nonce', type: 'uint256' },
                { name: 'from', type: 'address' },
                { name: 'functionSignature', type: 'bytes' },
              ],
            },
            domain: {
              name: 'QUICKSWAP_ROUTER_V2',
              version: '2',
              verifyingContract: contractAddress,
              salt: '0x' + chainId.toString(16).padStart(64, '0'),
            },
            primaryType: 'MetaTransaction',
            message,
          });

          const signedData = await library.send('eth_signTypedData_v3', [
            account,
            dataToSign,
          ]);

          const { v, r, s } = ethers.utils.splitSignature(signedData);

          console.log({ account, functionSignature, r, s, v });

          let biconomyResponse: any;

          try {
            // Uncommet below lines to throw a test error
            // if (!biconomyResponse) {
            //   throw new Error('Test error');
            // }
            console.log('starting');
            const response = await biconomyContract.executeMetaTransaction(
              account,
              functionSignature,
              r,
              s,
              v,
            );
            console.log('succcess');
            biconomyResponse = response;
          } catch (e) {
            const error: any = e;
            // Note:
            // This catch block is not firing even though the try block generates an error
            // The error is generated from biconomy.js, but it does not bubble up
            // If an error is manually triggered, then the catch block runs
            console.error(error);

            console.log('reached catch block');
            // if the user rejected the tx, pass this along
            if (error?.code === 4001) {
              throw new Error('Transaction rejected.');
            } else {
              // otherwise, the error was unexpected and we need to convey that
              console.error(`Swap failed`, error, methodName, args, value);
              throw new Error(`Swap failed: ${error.message}`);
            }
          }

          console.log(biconomyResponse);

          const inputSymbol = trade.inputAmount.currency.symbol;
          const outputSymbol = trade.outputAmount.currency.symbol;
          const inputAmount = trade.inputAmount.toSignificant(3);
          const outputAmount = trade.outputAmount.toSignificant(3);

          const base = `Swap ${inputAmount} ${inputSymbol} for ${outputAmount} ${outputSymbol}`;
          const withRecipient =
            recipient === account
              ? base
              : `${base} to ${
                  recipientAddressOrName && isAddress(recipientAddressOrName)
                    ? shortenAddress(recipientAddressOrName)
                    : recipientAddressOrName
                }`;

          const withVersion =
            tradeVersion === Version.v2
              ? withRecipient
              : `${withRecipient} on ${(tradeVersion as any).toUpperCase()}`;

          if (!biconomyResponse.hash)
            biconomyResponse.hash = biconomyResponse.transactionHash;

          // Handle the case were necessary data is missing
          if (!biconomyResponse.hash || !biconomyResponse.wait) {
            console.error('Unexpected tx response', biconomyResponse);
            throw new Error(
              'Unexpected tx response. Please try again with gasless off.',
            );
          }

          addTransaction(biconomyResponse, {
            summary: withVersion,
          });

          //@notice
          //it does expect wait
          return { response: biconomyResponse, summary: withVersion };
        }
      },
      error: null,
    };
  }, [
    trade,
    library,
    account,
    chainId,
    recipient,
    recipientAddressOrName,
    swapCalls,
    addTransaction,
    gaslessMode,
    biconomy,
    contractAddress,
  ]);
}
