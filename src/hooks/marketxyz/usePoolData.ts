import { useQuery } from 'react-query';
import { useMarket } from './useMarket';
import { useActiveWeb3React } from '../index';
import {
  fetchPoolData,
  getPoolIdFromComptroller,
  PoolData,
} from '../../utils/marketxyz/fetchPoolData';

import { Comptroller, PoolDirectoryV1 } from 'market-sdk';
import { useEffect, useState } from 'react';

export const usePoolsData = (
  poolAddresses: string[],
  directory: PoolDirectoryV1 | string,
) => {
  const { account } = useActiveWeb3React();
  const { sdk } = useMarket();
  const _directory = sdk
    ? typeof directory === 'string'
      ? new PoolDirectoryV1(sdk, directory)
      : directory
    : undefined;
  const getPoolsData = async () => {
    if (!_directory) return;
    const allPools = await _directory.getAllPools();
    const poolsData = await Promise.all(
      poolAddresses.map(async (poolAddress) => {
        const poolId = allPools.findIndex((p) => {
          return p.comptroller.address === poolAddress;
        });
        if (poolId === -1) return;
        const poolData = await fetchPoolData(
          poolId.toString(),
          account ?? undefined,
          _directory,
        );
        return poolData;
      }),
    );
    return poolsData;
  };
  const { data } = useQuery('FetchPoolsData', getPoolsData, {
    refetchInterval: 3000,
  });

  return data;
};

export const usePoolData = (
  poolId: string | null | undefined,
  directory: PoolDirectoryV1 | string,
): PoolData | undefined => {
  const { account } = useActiveWeb3React();
  const { sdk } = useMarket();
  const _directory = sdk
    ? typeof directory === 'string'
      ? new PoolDirectoryV1(sdk, directory)
      : directory
    : undefined;
  const getPoolData = async () => {
    if (!_directory) return;
    const poolData = await fetchPoolData(
      poolId ?? undefined,
      account ?? undefined,
      _directory,
    );
    return poolData;
  };
  const { data } = useQuery('FetchPoolData', getPoolData, {
    refetchInterval: 3000,
  });

  return data;
};

export const usePoolDataComptroller = (
  comptroller: Comptroller | string,
  directory: PoolDirectoryV1 | string,
) => {
  const { account } = useActiveWeb3React();
  const { sdk } = useMarket();
  const [data, setData] = useState<PoolData>();

  useEffect(() => {
    if (!sdk) {
      return;
    }
    const _directory =
      typeof directory === 'string'
        ? new PoolDirectoryV1(sdk, directory)
        : directory;

    (async () => {
      const poolId = await getPoolIdFromComptroller(comptroller, _directory);
      const data = await fetchPoolData(
        poolId,
        account ?? undefined,
        _directory,
      );

      return data;
    })();
  }, [sdk, account, comptroller, directory]);

  return data;
};