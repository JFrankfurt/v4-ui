import { Token } from '@pooltogether/hooks'
import { PrizeDistribution } from '@pooltogether/v4-js-client'
import { BigNumber } from '@ethersproject/bignumber'
import { parseUnits } from '@ethersproject/units'
import { numberWithCommas } from '@pooltogether/utilities'

export const DECIMALS_FOR_DISTRIBUTIONS = '9'

export const TSUNAMI_USDC_DRAW_SETTINGS: PrizeDistribution = Object.freeze({
  matchCardinality: 3,
  pickCost: parseUnits('1', 18),
  distributions: [
    parseUnits('0.5', DECIMALS_FOR_DISTRIBUTIONS).toNumber(),
    parseUnits('0.3', DECIMALS_FOR_DISTRIBUTIONS).toNumber(),
    parseUnits('0.2', DECIMALS_FOR_DISTRIBUTIONS).toNumber()
  ],
  bitRangeSize: 2,
  maxPicksPerUser: 10,
  numberOfPicks: BigNumber.from(1000),
  prize: BigNumber.from('100000000000000000000'),
  drawStartTimestampOffset: 0,
  drawEndTimestampOffset: 0
})
