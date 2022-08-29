import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useCurrency } from 'hooks/v3/Tokens';
import usePrevious from 'hooks/usePrevious';
import { useActiveWeb3React } from 'hooks';
import {
  NavLink,
  RouteComponentProps,
  Switch,
  useHistory,
  useParams,
  useRouteMatch,
} from 'react-router-dom';
import {
  useV3DerivedMintInfo,
  useV3MintState,
  useV3MintActionHandlers,
  useInitialUSDPrices,
  useCurrentStep,
} from 'state/mint/v3/hooks';
import { Stepper } from './components/Stepper';
import { EnterAmounts } from './containers/EnterAmounts';
import { SelectPair } from './containers/SelectPair';
import { SelectRange } from './containers/SelectRange';
import { ReactComponent as SettingsIcon } from 'assets/images/SettingsIcon.svg';
import { ReactComponent as WarningIcon } from 'assets/images/warningIcon.svg';
import { ReactComponent as LockIcon } from 'assets/images/lockIcon.svg';

import { Currency, Percent } from '@uniswap/sdk-core';

import './index.scss';
import { WMATIC_EXTENDED } from 'constants/tokens';
import {
  setInitialTokenPrice,
  setInitialUSDPrices,
  updateCurrentStep,
  updateSelectedPreset,
} from 'state/mint/v3/actions';
import { Field } from 'state/mint/actions';
import useUSDCPrice from 'hooks/v3/useUSDCPrice';
import {
  PriceFormats,
  PriceFormatToggler,
} from './components/PriceFomatToggler';
import { AddLiquidityButton } from './containers/AddLiquidityButton';
import { PoolState } from 'hooks/v3/usePools';

import { useAppDispatch } from 'state/hooks';

import { useUserSlippageTolerance } from 'state/user/hooks';
import { JSBI } from '@uniswap/sdk';
import { currencyId } from 'utils/v3/currencyId';
import { Box } from '@material-ui/core';
import {
  StyledWarningButton,
  LinkButton,
  OverlayCard,
  StyledLabel,
  StyledWarningBox,
} from '../Common/styledElements';
// import RateToggle from 'components/RateToggle';
import { useTranslation } from 'react-i18next';
// import CurrencyInputV3 from 'components/CurrencyInputV3';
import { isSupportedNetwork } from 'utils';
import SettingsModal from 'components/SettingsModal';

const DEFAULT_ADD_IN_RANGE_SLIPPAGE_TOLERANCE = new Percent(50, 10_000);

export function NewAddLiquidityPage() {
  const params: any = useParams();

  const currencyIdA =
    params.currencyIdA ?? '0x36ee587b148cfb474f1211b1c1edef2116285d28'; //'0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619';
  const currencyIdB =
    params.currencyIdB ?? '0xe68c76bd4cceea3bb6655ff708f847206f3d5b3c'; //'0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';

  const history = useHistory();
  const [isRejected, setRejected] = useState(false);

  const { account, chainId } = useActiveWeb3React();
  const { t } = useTranslation();

  const dispatch = useAppDispatch();

  const feeAmount = 100;

  const currentStep = useCurrentStep();

  const [priceFormat, setPriceFormat] = useState(PriceFormats.TOKEN);

  useEffect(() => {
    onFieldAInput('');
    onFieldBInput('');
    onLeftRangeInput('');
    onRightRangeInput('');
  }, [currencyIdA, currencyIdB]);

  const baseCurrency = useCurrency(currencyIdA);
  const currencyB = useCurrency(currencyIdB);
  // prevent an error if they input ETH/WETH
  //TODO
  const quoteCurrency =
    baseCurrency && currencyB && baseCurrency.wrapped.equals(currencyB.wrapped)
      ? undefined
      : currencyB;

  const derivedMintInfo = useV3DerivedMintInfo(
    baseCurrency ?? undefined,
    quoteCurrency ?? undefined,
    feeAmount,
    baseCurrency ?? undefined,
    undefined,
  );
  const prevDerivedMintInfo = usePrevious({ ...derivedMintInfo });

  const mintInfo = useMemo(() => {
    if (
      (!derivedMintInfo.pool ||
        !derivedMintInfo.price ||
        derivedMintInfo.noLiquidity) &&
      prevDerivedMintInfo
    ) {
      return {
        ...prevDerivedMintInfo,
        pricesAtTicks: derivedMintInfo.pricesAtTicks,
        ticks: derivedMintInfo.ticks,
        parsedAmounts: derivedMintInfo.parsedAmounts,
      };
    }
    return {
      ...derivedMintInfo,
    };
  }, [derivedMintInfo, baseCurrency, quoteCurrency]);

  const initialUSDPrices = useInitialUSDPrices();
  const usdPriceA = useUSDCPrice(baseCurrency ?? undefined);
  const usdPriceB = useUSDCPrice(quoteCurrency ?? undefined);

  const {
    onFieldAInput,
    onFieldBInput,
    onLeftRangeInput,
    onRightRangeInput,
    onStartPriceInput,
  } = useV3MintActionHandlers(mintInfo.noLiquidity);

  const { startPriceTypedValue } = useV3MintState();

  const handleCurrencySelect = useCallback(
    (
      currencyNew: Currency,
      currencyIdOther?: string,
    ): (string | undefined)[] => {
      const currencyIdNew = currencyId(currencyNew, chainId || 137);

      let chainSymbol;

      if (chainId === 137) {
        chainSymbol = 'MATIC';
      }

      resetState();

      if (currencyIdNew.toLowerCase() === currencyIdOther?.toLowerCase()) {
        // not ideal, but for now clobber the other if the currency ids are equal
        return [currencyIdNew, undefined];
      } else {
        // prevent weth + eth
        const isETHOrWETHNew =
          currencyIdNew === chainSymbol ||
          (chainId !== undefined &&
            currencyIdNew === WMATIC_EXTENDED[chainId]?.address);
        const isETHOrWETHOther =
          currencyIdOther !== undefined &&
          (currencyIdOther === chainSymbol ||
            (chainId !== undefined &&
              currencyIdOther === WMATIC_EXTENDED[chainId]?.address));

        if (isETHOrWETHNew && isETHOrWETHOther) {
          return [currencyIdNew, undefined];
        } else {
          return [currencyIdNew, currencyIdOther];
        }
      }
    },
    [chainId],
  );

  const handleCurrencyASelect = useCallback(
    (currencyANew: Currency) => {
      console.log('token a', currencyANew);
      const [idA, idB] = handleCurrencySelect(currencyANew, currencyIdB);
      if (idB === undefined) {
        history.push(`/v3Pools/${idA}`);
      } else {
        history.push(`/v3Pools/${idA}/${idB}`);
      }
    },
    [handleCurrencySelect, currencyIdB, history],
  );

  const handleCurrencyBSelect = useCallback(
    (currencyBNew: Currency) => {
      const [idB, idA] = handleCurrencySelect(currencyBNew, currencyIdA);
      if (idA === undefined) {
        history.push(`/v3Pools/${idB}`);
      } else {
        history.push(`/v3Pools/${idA}/${idB}`);
      }
    },
    [handleCurrencySelect, currencyIdA, history],
  );

  const handleCurrencySwap = useCallback(() => {
    history.push(`/v3Pools/${currencyIdB}/${currencyIdA}`);
    resetState();
  }, [history, handleCurrencySelect, currencyIdA, currencyIdB]);

  const handlePopularPairSelection = useCallback((pair: [string, string]) => {
    const WMATIC = '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270';
    history.push(
      `/add/${pair[0] === WMATIC ? 'MATIC' : pair[0]}/${
        pair[1] === WMATIC ? 'MATIC' : pair[1]
      }`,
    );
    resetState();
  }, []);

  const handleStepChange = useCallback(
    (_step) => {
      history.push(`/add/${currencyIdA}/${currencyIdB}/${_step}`);
    },
    [currencyIdA, currencyIdB, history],
  );

  const handlePriceFormat = useCallback((priceFormat: PriceFormats) => {
    setPriceFormat(priceFormat);
  }, []);

  function resetState() {
    dispatch(updateSelectedPreset({ preset: null }));
    dispatch(setInitialTokenPrice({ typedValue: '' }));
    dispatch(setInitialUSDPrices({ field: Field.CURRENCY_A, typedValue: '' }));
    dispatch(setInitialUSDPrices({ field: Field.CURRENCY_B, typedValue: '' }));
    onStartPriceInput('');
  }

  const stepLinks = useMemo(() => {
    const _stepLinks = [
      {
        link: 'select-pair',
        title: `Select a pair`,
      },
    ];

    if (mintInfo.noLiquidity && baseCurrency && quoteCurrency) {
      _stepLinks.push({
        link: 'initial-price',
        title: `Set initial price`,
      });
    }

    _stepLinks.push(
      {
        link: 'select-range',
        title: `Select a range`,
      },
      {
        link: 'enter-amounts',
        title: `Enter amounts`,
      },
    );
    return _stepLinks;
  }, [baseCurrency, quoteCurrency, mintInfo]);

  const stepPair = useMemo(() => {
    return Boolean(
      baseCurrency &&
        quoteCurrency &&
        mintInfo.poolState !== PoolState.INVALID &&
        mintInfo.poolState !== PoolState.LOADING,
    );
  }, [baseCurrency, quoteCurrency, mintInfo]);

  const stepRange = useMemo(() => {
    return Boolean(
      mintInfo.lowerPrice &&
        mintInfo.upperPrice &&
        !mintInfo.invalidRange &&
        account,
    );
  }, [mintInfo]);

  const stepAmounts = useMemo(() => {
    if (mintInfo.outOfRange) {
      return Boolean(
        mintInfo.parsedAmounts[Field.CURRENCY_A] ||
          (mintInfo.parsedAmounts[Field.CURRENCY_B] && account),
      );
    }
    return Boolean(
      mintInfo.parsedAmounts[Field.CURRENCY_A] &&
        mintInfo.parsedAmounts[Field.CURRENCY_B] &&
        account,
    );
  }, [mintInfo]);

  const stepInitialPrice = useMemo(() => {
    return mintInfo.noLiquidity
      ? Boolean(+startPriceTypedValue && account)
      : false;
  }, [mintInfo, startPriceTypedValue]);

  const steps = useMemo(() => {
    if (mintInfo.noLiquidity) {
      return [stepPair, stepInitialPrice, stepRange, stepAmounts];
    }

    return [stepPair, stepRange, stepAmounts];
  }, [stepPair, stepRange, stepAmounts, stepInitialPrice, mintInfo]);

  const [allowedSlippage] = useUserSlippageTolerance();
  const allowedSlippagePercent: Percent = useMemo(() => {
    return new Percent(JSBI.BigInt(allowedSlippage), JSBI.BigInt(10000));
  }, [allowedSlippage]);

  const hidePriceFormatter = useMemo(() => {
    if (stepInitialPrice && currentStep < 2) {
      return false;
    }

    if (!stepInitialPrice && currentStep < 1) {
      return false;
    }

    return Boolean(
      (mintInfo.noLiquidity ? stepInitialPrice : stepPair) &&
        !initialUSDPrices.CURRENCY_A &&
        !initialUSDPrices.CURRENCY_B &&
        !usdPriceA &&
        !usdPriceB,
    );
  }, [
    mintInfo,
    currentStep,
    stepRange,
    stepInitialPrice,
    usdPriceA,
    usdPriceB,
    initialUSDPrices,
  ]);

  useEffect(() => {
    if (hidePriceFormatter) {
      handlePriceFormat(PriceFormats.TOKEN);
      setPriceFormat(PriceFormats.TOKEN);
    }
  }, [hidePriceFormatter]);

  const { ethereum } = window as any;
  const buttonText = useMemo(() => {
    if (account) {
      return mintInfo?.errorMessage ?? t('Preview');
    } else if (ethereum && !isSupportedNetwork(ethereum)) {
      return t('switchPolygon');
    }
    return t('connectWallet');
  }, [account, ethereum, mintInfo?.errorMessage, t]);

  const [openSettingsModal, setOpenSettingsModal] = useState(false);

  const handleSettingsModalOpen = useCallback(
    (flag: boolean) => {
      setOpenSettingsModal(flag);
    },
    [openSettingsModal, setOpenSettingsModal],
  );

  return (
    <Box>
      <Box className='flex justify-between items-center'>
        {openSettingsModal && (
          <SettingsModal
            open={openSettingsModal}
            onClose={() => setOpenSettingsModal(false)}
          />
        )}
        <StyledLabel fontSize='16px'>{t('supplyLiquidity')}</StyledLabel>
        <Box className='flex items-center'>
          <Box className='headingItem'>
            <Box
              className='flex flex-end'
              style={{ width: 'fit-content', minWidth: 'fit-content' }}
            >
              <LinkButton
                style={{ marginRight: 10, alignSelf: 'center' }}
                fontSize='14px'
              >
                {' '}
                {t('Clear All')}
              </LinkButton>
              <PriceFormatToggler
                currentFormat={priceFormat}
                handlePriceFormat={handlePriceFormat}
              />
            </Box>
          </Box>
          <Box className='headingItem'>
            <SettingsIcon onClick={() => handleSettingsModalOpen(true)} />
          </Box>
        </Box>
      </Box>
      <Box className='flex justify-between items-center' mt={2.5}>
        {t('Select Pair')}
      </Box>
      <Box mt={2.5}>
        <SelectPair
          baseCurrency={baseCurrency}
          quoteCurrency={quoteCurrency}
          mintInfo={mintInfo}
          isCompleted={stepPair}
          handleCurrencySwap={handleCurrencySwap}
          handleCurrencyASelect={handleCurrencyASelect}
          handleCurrencyBSelect={handleCurrencyBSelect}
          handlePopularPairSelection={handlePopularPairSelection}
          priceFormat={priceFormat}
        />
        <Box className='flex justify-between items-center' mt={2.5}>
          Select range
        </Box>

        <SelectRange
          currencyA={baseCurrency}
          currencyB={quoteCurrency}
          mintInfo={mintInfo}
          disabled={!stepPair}
          isCompleted={stepRange}
          additionalStep={stepInitialPrice}
          priceFormat={PriceFormats.TOKEN}
          backStep={stepInitialPrice ? 1 : 0}
        />

        {/* <StyledWarningBox>
          <Box height={56} className='flex justify-around items-center'>
            <WarningIcon />
            <Box width={'85%'}>
              <StyledLabel fontSize='12px' color='#fdd835'>
                Your position is out of range and will not earn fees or be used
                in trades until the market price moves into your range.{' '}
              </StyledLabel>
            </Box>
          </Box>
        </StyledWarningBox>


        <StyledWarningBox>
          <Box
            mt={1.5}
            // padding={2}
            className='flex flex-col justify-center '
            width={'100%'}
            height={'140px'}
          >
            <Box ml={1.5} className='flex items-center'>
              <WarningIcon />

              <StyledLabel className='ml-1' fontSize='14px' color='#fdd835'>
                Efficiency Comparison
              </StyledLabel>
            </Box>

            <Box ml={1.5} width='85%' mt={1}>
              <StyledLabel fontSize='12px' color='#fdd835'>
                Full range positions may earn less fees than concentrated
                positions. Learn more{' '}
                <a href='#' style={{ color: 'inherit' }}>
                  here
                </a>
              </StyledLabel>
            </Box>

            <Box ml={1.5} mt={2.5} mb={1}>
              <StyledWarningButton>
                <StyledLabel fontSize='13px' color='#12131a'>
                  I Understand
                </StyledLabel>
              </StyledWarningButton>
            </Box>
          </Box>
        </StyledWarningBox>


        <OverlayCard>
          <Box
            className='flex flex-col justify-center items-center'
            width={'100%'}
            height={'107px'}
          >
            <LockIcon />
            <Box width={'75%'}>
              <StyledLabel
                className='text-center'
                fontSize='12px'
                color='#c7cad9'
              >
                The market price is outside your specified price range.
                Single-asset deposit only.
              </StyledLabel>
            </Box>
          </Box>
        </OverlayCard> */}

        <Box className='flex justify-between items-center' mt={2.5} mb={2.5}>
          Deposit Amounts
        </Box>

        <EnterAmounts
          currencyA={baseCurrency ?? undefined}
          currencyB={quoteCurrency ?? undefined}
          mintInfo={mintInfo}
          priceFormat={priceFormat}
        />

        <Box mt={2.5}>
          <AddLiquidityButton
            title={buttonText}
            baseCurrency={baseCurrency ?? undefined}
            quoteCurrency={quoteCurrency ?? undefined}
            mintInfo={mintInfo}
            setRejected={setRejected}
            handleAddLiquidity={() => {
              console.log('liq a');
            }}
            priceFormat={priceFormat}
            handlePriceFormat={handlePriceFormat}
          />
        </Box>
      </Box>
    </Box>
  );
}
