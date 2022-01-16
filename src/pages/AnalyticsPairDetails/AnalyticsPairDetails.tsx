import React, { useState, useEffect, useMemo } from 'react';
import { useHistory, useRouteMatch, Link } from 'react-router-dom';
import { Box, Typography, Grid, useMediaQuery } from '@material-ui/core';
import { ArrowForwardIos } from '@material-ui/icons';
import { makeStyles, useTheme } from '@material-ui/core/styles';
import { Skeleton } from '@material-ui/lab';
import { ChainId, Token } from '@uniswap/sdk';
import moment from 'moment';
import cx from 'classnames';
import {
  shortenAddress,
  getEtherscanLink,
  formatCompact,
  getPairTransactions,
  getPairChartData,
  formatDateFromTimeStamp,
  getFormattedPrice,
  getPriceColor,
  getEthPrice,
  getBulkPairData,
} from 'utils';
import { useActiveWeb3React } from 'hooks';
import {
  CurrencyLogo,
  AreaChart,
  DoubleCurrencyLogo,
  TransactionsTable,
} from 'components';
import { getAddress } from '@ethersproject/address';
import { GlobalConst } from 'constants/index';

const useStyles = makeStyles(({ palette, breakpoints }) => ({
  panel: {
    background: palette.grey.A700,
    borderRadius: 20,
    padding: 24,
    [breakpoints.down('xs')]: {
      padding: 12,
    },
  },
  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    color: palette.text.hint,
    marginBottom: 50,
    '& svg': {
      width: 12,
      margin: '0 6px',
    },
  },
  link: {
    cursor: 'pointer',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
  heading1: {
    fontSize: 32,
    fontWeight: 'bold',
    color: palette.text.primary,
    lineHeight: 1,
    [breakpoints.down('xs')]: {
      fontSize: 22,
      fontWeight: 600,
    },
  },
  heading2: {
    fontSize: 32,
    lineHeight: 1.2,
    fontWeight: 600,
    color: palette.text.primary,
    marginLeft: 6,
    [breakpoints.down('xs')]: {
      fontSize: 18,
    },
    '& a': {
      color: palette.text.primary,
      textDecoration: 'none',
    },
  },
  priceChangeWrapper: {
    height: 25,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    padding: '0 8px',
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    height: 40,
    padding: '0 28px',
    borderRadius: 10,
    color: palette.text.primary,
    cursor: 'pointer',
  },
  filledButton: {
    background: 'linear-gradient(279deg, rgb(0, 76, 230), rgb(61, 113, 255))',
  },
  chartType: {
    height: 20,
    padding: '0 6px',
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
  },
}));

const CHART_VOLUME = 0;
const CHART_LIQUIDITY = 1;
const CHART_FEES = 2;

const AnalyticsPairDetails: React.FC = () => {
  const classes = useStyles();
  const { palette, breakpoints } = useTheme();
  const isMobile = useMediaQuery(breakpoints.down('xs'));
  const history = useHistory();
  const match = useRouteMatch<{ id: string }>();
  const pairAddress = match.params.id;
  const [pairData, setPairData] = useState<any>(null);
  const [pairChartData, setPairChartData] = useState<any[] | null>(null);
  const [pairTransactions, setPairTransactions] = useState<any>(null);
  const pairTransactionsList = useMemo(() => {
    if (pairTransactions) {
      const mints = pairTransactions.mints.map((item: any) => {
        return { ...item, type: 'Add' };
      });
      const swaps = pairTransactions.mints.map((item: any) => {
        return { ...item, type: 'Swap' };
      });
      const burns = pairTransactions.mints.map((item: any) => {
        return { ...item, type: 'Remove' };
      });
      return mints.concat(swaps).concat(burns);
    } else {
      return null;
    }
  }, [pairTransactions]);
  const { chainId } = useActiveWeb3React();
  const currency0 = pairData
    ? new Token(
        ChainId.MATIC,
        getAddress(pairData.token0.id),
        pairData.token0.decimals,
      )
    : undefined;
  const currency1 = pairData
    ? new Token(
        ChainId.MATIC,
        getAddress(pairData.token1.id),
        pairData.token1.decimals,
      )
    : undefined;

  const token0Rate =
    pairData && pairData.reserve0 && pairData.reserve1
      ? Number(pairData.reserve1) / Number(pairData.reserve0) >= 0.0001
        ? (Number(pairData.reserve1) / Number(pairData.reserve0)).toFixed(
            Number(pairData.reserve1) / Number(pairData.reserve0) > 1 ? 2 : 4,
          )
        : '< 0.0001'
      : '-';
  const token1Rate =
    pairData && pairData.reserve0 && pairData.reserve1
      ? Number(pairData.reserve0) / Number(pairData.reserve1) >= 0.0001
        ? (Number(pairData.reserve0) / Number(pairData.reserve1)).toFixed(
            Number(pairData.reserve0) / Number(pairData.reserve1) > 1 ? 2 : 4,
          )
        : '< 0.0001'
      : '-';
  const usingUtVolume =
    pairData &&
    pairData.oneDayVolumeUSD === 0 &&
    !!pairData.oneDayVolumeUntracked;
  const fees =
    pairData && (pairData.oneDayVolumeUSD || pairData.oneDayVolumeUSD === 0)
      ? usingUtVolume
        ? (
            Number(pairData.oneDayVolumeUntracked) * GlobalConst.FEEPERCENT
          ).toLocaleString()
        : (
            Number(pairData.oneDayVolumeUSD) * GlobalConst.FEEPERCENT
          ).toLocaleString()
      : '-';
  const [chartIndex, setChartIndex] = useState(CHART_VOLUME);

  useEffect(() => {
    async function checkEthPrice() {
      const [newPrice] = await getEthPrice();
      const pairInfo = await getBulkPairData([pairAddress], newPrice);
      if (pairInfo && pairInfo.length > 0) {
        setPairData(pairInfo[0]);
      }
    }
    async function fetchTransctions() {
      const transactions = await getPairTransactions(pairAddress);
      if (transactions) {
        setPairTransactions(transactions);
      }
    }
    checkEthPrice();
    fetchTransctions();
  }, [pairAddress]);

  const chartData = useMemo(() => {
    if (pairChartData) {
      return pairChartData.map((item: any) =>
        chartIndex === CHART_VOLUME
          ? Number(item.dailyVolumeUSD)
          : chartIndex === CHART_LIQUIDITY
          ? Number(item.reserveUSD)
          : Number(item.dailyVolumeUSD) * GlobalConst.FEEPERCENT,
      );
    } else {
      return null;
    }
  }, [pairChartData, chartIndex]);

  const yAxisValues = useMemo(() => {
    if (chartData) {
      const minValue = Math.min(...chartData) * 0.99;
      const maxValue = Math.max(...chartData) * 1.01;
      const step = (maxValue - minValue) / 8;
      const values = [];
      for (let i = 0; i < 9; i++) {
        values.push(maxValue - i * step);
      }
      return values;
    } else {
      return undefined;
    }
  }, [chartData]);

  const chartDates = useMemo(() => {
    if (pairChartData) {
      const dates: string[] = [];
      pairChartData.forEach((value: any, ind: number) => {
        const month = formatDateFromTimeStamp(Number(value.date), 'MMM');
        const monthLastDate =
          ind > 0
            ? formatDateFromTimeStamp(
                Number(pairChartData[ind - 1].date),
                'MMM',
              )
            : '';
        if (monthLastDate !== month) {
          dates.push(month);
        }
        const dateStr = formatDateFromTimeStamp(Number(value.date), 'D');
        if (Number(dateStr) % 7 === 0) {
          dates.push(dateStr);
        }
      });
      return dates;
    } else {
      return [];
    }
  }, [pairChartData]);

  const currentData = useMemo(
    () =>
      pairData
        ? chartIndex === CHART_VOLUME
          ? pairData.oneDayVolumeUSD
          : chartIndex === CHART_LIQUIDITY
          ? pairData.reserveUSD
            ? pairData.reserveUSD
            : pairData.trackedReserveUSD
          : fees
        : null,
    [pairData, chartIndex, fees],
  );
  const currentPercent = useMemo(
    () =>
      pairData
        ? chartIndex === CHART_VOLUME
          ? pairData.volumeChangeUSD
          : chartIndex === CHART_LIQUIDITY
          ? pairData.liquidityChangeUSD
          : (usingUtVolume
              ? pairData.volumeChangeUntracked
              : pairData.volumeChangeUSD) * GlobalConst.FEEPERCENT
        : null,
    [pairData, chartIndex, usingUtVolume],
  );

  useEffect(() => {
    async function fetchPairChartData() {
      const chartData = await getPairChartData(pairAddress);
      if (chartData && chartData.length > 0) {
        setPairChartData(chartData);
      }
    }
    fetchPairChartData();
  }, [pairAddress]);

  const currentPercentColor = getPriceColor(Number(currentPercent), palette);

  return (
    <>
      {pairData ? (
        <>
          <Box className={classes.breadcrumb} width={1}>
            <Typography
              variant='caption'
              className={classes.link}
              onClick={() => {
                history.push('/analytics');
              }}
            >
              Analytics
            </Typography>
            <ArrowForwardIos />
            <Typography
              variant='caption'
              className={classes.link}
              onClick={() => {
                history.push('/analytics?tabIndex=2');
              }}
            >
              Pairs
            </Typography>
            <ArrowForwardIos />
            <Typography variant='caption'>
              <span style={{ color: '#b6b9cc' }}>
                {pairData.token0.symbol}/{pairData.token1.symbol}
              </span>
              ({shortenAddress(pairAddress)})
            </Typography>
          </Box>
          <Box
            width={1}
            display='flex'
            flexWrap='wrap'
            justifyContent='space-between'
          >
            <Box>
              <Box display='flex' alignItems='center'>
                <DoubleCurrencyLogo
                  currency0={currency0}
                  currency1={currency1}
                  size={32}
                />
                <Box ml={1}>
                  <Typography className={classes.heading2}>
                    <Link to={`/analytics/token/${pairData.token0.id}`}>
                      {pairData.token0.symbol}
                    </Link>{' '}
                    /{' '}
                    <Link to={`/analytics/token/${pairData.token1.id}`}>
                      {pairData.token1.symbol}
                    </Link>
                  </Typography>
                </Box>
              </Box>
              <Box mt={2} display='flex'>
                <Box
                  paddingY={0.75}
                  paddingX={1.5}
                  borderRadius={20}
                  display='flex'
                  alignItems='center'
                  bgcolor={palette.grey.A700}
                >
                  <CurrencyLogo currency={currency0} size='16px' />
                  <Typography
                    variant='body2'
                    color='textPrimary'
                    style={{ marginLeft: 6 }}
                  >
                    1 {pairData.token0.symbol} = {token0Rate}{' '}
                    {pairData.token1.symbol}
                  </Typography>
                </Box>
                <Box
                  padding={0.75}
                  paddingX={1.5}
                  ml={2}
                  borderRadius={20}
                  display='flex'
                  alignItems='center'
                  bgcolor={palette.grey.A700}
                >
                  <CurrencyLogo currency={currency1} size='16px' />
                  <Typography
                    variant='body2'
                    color='textPrimary'
                    style={{ marginLeft: 6 }}
                  >
                    1 {pairData.token1.symbol} = {token1Rate}{' '}
                    {pairData.token0.symbol}
                  </Typography>
                </Box>
              </Box>
            </Box>
            <Box my={2} display='flex'>
              <Box
                className={classes.button}
                mr={1.5}
                border={`1px solid ${palette.primary.main}`}
                onClick={() => {
                  history.push(
                    `/pools?currency0=${pairData.token0.id}&currency1=${pairData.token1.id}`,
                  );
                }}
              >
                <Typography variant='body2'>Add Liquidity</Typography>
              </Box>
              <Box
                className={cx(classes.button, classes.filledButton)}
                onClick={() => {
                  history.push(
                    `/swap?currency0=${pairData.token0.id}&currency1=${pairData.token1.id}`,
                  );
                }}
              >
                <Typography variant='body2'>Swap</Typography>
              </Box>
            </Box>
          </Box>
          <Box width={1} className={classes.panel} mt={4}>
            <Grid container>
              <Grid item xs={12} sm={12} md={6}>
                <Box
                  display='flex'
                  flexWrap='wrap'
                  justifyContent='space-between'
                >
                  <Box mt={1.5}>
                    <Typography variant='caption'>
                      {chartIndex === CHART_VOLUME
                        ? 'Volume'
                        : chartIndex === CHART_LIQUIDITY
                        ? 'Liquidity'
                        : 'Price'}
                    </Typography>
                    <Box mt={1}>
                      {currentPercent && currentData ? (
                        <>
                          <Box display='flex' alignItems='center'>
                            <Typography
                              variant='h4'
                              style={{ color: palette.text.primary }}
                            >
                              $
                              {currentData > 100000
                                ? formatCompact(currentData)
                                : currentData.toLocaleString()}
                            </Typography>
                            <Box
                              className={classes.priceChangeWrapper}
                              ml={1}
                              bgcolor={currentPercentColor.bgColor}
                              color={currentPercentColor.textColor}
                            >
                              <Typography variant='body2'>
                                {getFormattedPrice(Number(currentPercent))}%
                              </Typography>
                            </Box>
                          </Box>
                          <Box>
                            <Typography variant='caption'>
                              {moment().format('MMM DD, YYYY')}
                            </Typography>
                          </Box>
                        </>
                      ) : (
                        <Skeleton variant='rect' width='120px' height='30px' />
                      )}
                    </Box>
                  </Box>
                  <Box display='flex' mt={1.5}>
                    <Box
                      mr={1}
                      bgcolor={
                        chartIndex === CHART_VOLUME
                          ? palette.grey.A400
                          : 'transparent'
                      }
                      className={classes.chartType}
                      onClick={() => setChartIndex(CHART_VOLUME)}
                    >
                      <Typography variant='caption'>Volume</Typography>
                    </Box>
                    <Box
                      mr={1}
                      bgcolor={
                        chartIndex === CHART_LIQUIDITY
                          ? palette.grey.A400
                          : 'transparent'
                      }
                      className={classes.chartType}
                      onClick={() => setChartIndex(CHART_LIQUIDITY)}
                    >
                      <Typography variant='caption'>Liquidity</Typography>
                    </Box>
                    <Box
                      bgcolor={
                        chartIndex === CHART_FEES
                          ? palette.grey.A400
                          : 'transparent'
                      }
                      className={classes.chartType}
                      onClick={() => setChartIndex(CHART_FEES)}
                    >
                      <Typography variant='caption'>Fees</Typography>
                    </Box>
                  </Box>
                </Box>
                <Box mt={2} width={1}>
                  {chartData && pairChartData ? (
                    <AreaChart
                      data={chartData}
                      yAxisValues={yAxisValues}
                      dates={pairChartData.map((value: any) =>
                        moment(value.date * 1000)
                          .add(1, 'day')
                          .unix(),
                      )}
                      width='100%'
                      height={240}
                      categories={chartDates}
                    />
                  ) : (
                    <Skeleton variant='rect' width='100%' height={200} />
                  )}
                </Box>
              </Grid>
              <Grid item xs={12} sm={12} md={6}>
                <Box
                  my={2}
                  height={1}
                  display='flex'
                  justifyContent='center'
                  alignItems='center'
                >
                  <Box
                    width={isMobile ? 1 : 0.8}
                    display='flex'
                    justifyContent='space-between'
                  >
                    <Box width={212}>
                      <Box>
                        <Typography
                          variant='caption'
                          style={{ color: palette.text.disabled }}
                        >
                          TOTAL TOKENS LOCKED
                        </Typography>
                        <Box
                          mt={1.5}
                          bgcolor={palette.grey.A400}
                          borderRadius={8}
                          padding={1.5}
                        >
                          <Box
                            display='flex'
                            alignItems='center'
                            justifyContent='space-between'
                          >
                            <Box display='flex' alignItems='center'>
                              <CurrencyLogo currency={currency0} size='16px' />
                              <Typography
                                variant='caption'
                                color='textPrimary'
                                style={{ marginLeft: 6 }}
                              >
                                {pairData.token0.symbol} :
                              </Typography>
                            </Box>
                            <Typography variant='caption' color='textPrimary'>
                              {Number(pairData.reserve0).toLocaleString()}
                            </Typography>
                          </Box>
                          <Box
                            mt={1}
                            display='flex'
                            alignItems='center'
                            justifyContent='space-between'
                          >
                            <Box display='flex' alignItems='center'>
                              <CurrencyLogo currency={currency1} size='16px' />
                              <Typography
                                variant='caption'
                                color='textPrimary'
                                style={{ marginLeft: 6 }}
                              >
                                {pairData.token1.symbol} :
                              </Typography>
                            </Box>
                            <Typography variant='caption' color='textPrimary'>
                              {Number(pairData.reserve1).toLocaleString()}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                      <Box mt={4}>
                        <Typography
                          variant='caption'
                          style={{ color: palette.text.disabled }}
                        >
                          7d Trading Vol
                        </Typography>
                        <Typography variant={isMobile ? 'body1' : 'h5'}>
                          ${pairData.oneWeekVolumeUSD.toLocaleString()}
                        </Typography>
                      </Box>
                      <Box mt={4}>
                        <Typography
                          variant='caption'
                          style={{ color: palette.text.disabled }}
                        >
                          24h FEES
                        </Typography>
                        <Typography variant={isMobile ? 'body1' : 'h5'}>
                          ${fees}
                        </Typography>
                      </Box>
                    </Box>
                    <Box width={140}>
                      <Typography
                        variant='caption'
                        style={{ color: palette.text.disabled }}
                      >
                        TOTAL LIQUIDITY
                      </Typography>
                      <Typography variant={isMobile ? 'body1' : 'h5'}>
                        $
                        {Number(
                          pairData.reserveUSD
                            ? pairData.reserveUSD
                            : pairData.trackedReserveUSD,
                        ).toLocaleString()}
                      </Typography>
                      <Box mt={4}>
                        <Typography
                          variant='caption'
                          style={{ color: palette.text.disabled }}
                        >
                          24h Trading Vol
                        </Typography>
                        <Typography variant={isMobile ? 'body1' : 'h5'}>
                          ${pairData.oneDayVolumeUSD.toLocaleString()}
                        </Typography>
                      </Box>
                      <Box mt={4}>
                        <Typography
                          variant='caption'
                          style={{ color: palette.text.disabled }}
                        >
                          Contract Address
                        </Typography>
                        <Typography
                          variant='h5'
                          style={{ color: palette.primary.main }}
                        >
                          {chainId ? (
                            <a
                              href={getEtherscanLink(
                                chainId,
                                pairData.id,
                                'address',
                              )}
                              target='_blank'
                              rel='noreferrer'
                              style={{
                                color: palette.primary.main,
                                textDecoration: 'none',
                              }}
                            >
                              {shortenAddress(pairData.id)}
                            </a>
                          ) : (
                            shortenAddress(pairData.id)
                          )}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Box>
          <Box width={1} mt={5}>
            <Typography variant='body1'>Transactions</Typography>
          </Box>
          <Box width={1} className={classes.panel} mt={4}>
            {pairTransactionsList ? (
              <TransactionsTable data={pairTransactionsList} />
            ) : (
              <Skeleton variant='rect' width='100%' height={150} />
            )}
          </Box>
        </>
      ) : (
        <Skeleton width='100%' height={100} />
      )}
    </>
  );
};

export default AnalyticsPairDetails;