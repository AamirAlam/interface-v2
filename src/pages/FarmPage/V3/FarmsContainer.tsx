import { Box } from '@material-ui/core';
import { StyledDarkBox } from 'components/AddLiquidityV3/CommonStyledElements';
import CustomTabSwitch from 'components/v3/CustomTabSwitch';
import { GlobalConst } from 'constants/index';
import { useActiveWeb3React } from 'hooks';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import FarmCard from './FarmCard';

export default function FarmsContainer() {
  const { chainId } = useActiveWeb3React();
  const { t } = useTranslation();

  const [v3FarmIndex, setV3FarmIndex] = useState(
    GlobalConst.v3FarmIndex.ETERNAL_FARMS_INDEX,
  );

  const v3FarmCategories = [
    {
      text: t('myFarms'),
      onClick: () => {
        setV3FarmIndex(GlobalConst.v3FarmIndex.MY_FARMS_INDEX);
      },
      condition: v3FarmIndex === GlobalConst.v3FarmIndex.MY_FARMS_INDEX,
    },
    {
      text: t('enternalFarms'),
      onClick: () => {
        setV3FarmIndex(GlobalConst.v3FarmIndex.ETERNAL_FARMS_INDEX);
      },
      condition: v3FarmIndex === GlobalConst.v3FarmIndex.ETERNAL_FARMS_INDEX,
    },
  ];

  return (
    <StyledDarkBox>
      <Box width='100%' mt={2}>
        <CustomTabSwitch
          width={300}
          height={58}
          items={v3FarmCategories}
          isLarge={true}
        />

        <Box
          mt={2.5}
          mb={2.5}
          display='flex'
          flexDirection='column'
          alignItems='center'
          justifyContent={'center'}
        >
          <FarmCard />
          <FarmCard />
        </Box>
      </Box>
    </StyledDarkBox>
  );
}
