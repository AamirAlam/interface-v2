import { Box } from '@material-ui/core';
import { AddBox } from '@material-ui/icons';
import { DoubleCurrencyLogo } from 'components';
import {
  StyledCircle,
  StyledFilledBox,
  StyledLabel,
} from 'components/v3/Common/styledElements';
import React, { useState } from 'react';
import { ReactComponent as ExpandIcon } from 'assets/images/expand_circle.svg';
import { ReactComponent as ExpandIconUp } from 'assets/images/expand_circle_up.svg';

export default function FarmCard() {
  const [showMore, setShowMore] = useState(false);

  return (
    <StyledFilledBox width='95%' borderRadius='16px' mt={1.5} mb={1.5}>
      <Box
        className='flex justify-between items-center'
        height={80}
        borderRadius={10}
      >
        <Box ml={2.5}>
          <Box className='flex justiy-center items-center item-start'>
            <Box mr={2}>
              <StyledCircle>1845</StyledCircle>
            </Box>

            <Box className='flex-col' ml={2.5} mr={2.5}>
              <Box>
                <StyledLabel color='#696c80' fontSize='14px'>
                  Out of range
                </StyledLabel>
              </Box>

              <StyledLabel color='#ebecf2' fontSize='14px'>
                View Positions
              </StyledLabel>
            </Box>

            <DoubleCurrencyLogo
              currency0={undefined}
              currency1={undefined}
              size={30}
            />

            <Box className='flex-col' ml={2.5}>
              <StyledLabel color='#696c80' fontSize='12px'>
                Pool
              </StyledLabel>

              <StyledLabel color='#ebecf2' fontSize='14px'>
                QUICK/USDC
              </StyledLabel>
            </Box>
          </Box>
        </Box>

        <Box
          mr={2.5}
          onClick={() => setShowMore(!showMore)}
          className='cursor-pointer'
        >
          {showMore ? <ExpandIconUp /> : <ExpandIcon />}
        </Box>
      </Box>
    </StyledFilledBox>
  );
}
