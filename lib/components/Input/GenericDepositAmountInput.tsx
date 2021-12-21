import React, { useEffect } from 'react'
import classNames from 'classnames'
import { TokenWithBalance } from '@pooltogether/hooks'
import { useTranslation } from 'react-i18next'
import { ThemedClipSpinner, TokenIcon } from '@pooltogether/react-components'
import { getMaxPrecision, safeParseUnits } from '@pooltogether/utilities'
import { FieldValues, UseFormReturn } from 'react-hook-form'

import { useMinimumDepositAmount } from 'lib/hooks/Tsunami/PrizePool/useMinimumDepositAmount'
import { usePrizePoolTokens } from 'lib/hooks/Tsunami/PrizePool/usePrizePoolTokens'
import { useUsersPrizePoolBalances } from 'lib/hooks/Tsunami/PrizePool/useUsersPrizePoolBalances'
import { useUsersAddress } from 'lib/hooks/useUsersAddress'

import WalletIcon from 'assets/images/icon-wallet.svg'

interface GenericDepositAmountInputProps {
  form: UseFormReturn<FieldValues, object>
  tokenBalanceIsFetched: Boolean
  tokenBalance: TokenWithBalance
  ticketBalance: TokenWithBalance
  prizePool: { chainId: number }
  inputKey: string
  className?: string
  widthClassName?: string
}

/**
 * For use in conjunction with react-hook-form
 * @param props
 * @returns
 */
export const GenericDepositAmountInput = (props: GenericDepositAmountInputProps) => {
  const { className, widthClassName } = props

  return (
    <div
      className={classNames(className, widthClassName, 'flex flex-col', 'font-inter', 'text-xl')}
    >
      <GenericDepositInputHeader {...props} />

      <div
        className={classNames(
          'p-0.5 bg-tertiary rounded-lg overflow-hidden',
          'transition-all hover:bg-gradient-cyan focus-within:bg-pt-gradient',
          'cursor-pointer'
        )}
      >
        <div className='bg-tertiary w-full rounded-lg flex'>
          <DepositToken {...props} />
          <Input {...props} />
        </div>
      </div>
    </div>
  )
}

GenericDepositAmountInput.defaultProps = {
  widthClassName: 'w-full'
}

interface GenericDepositInputHeaderProps extends GenericDepositAmountInputProps {}

const GenericDepositInputHeader = (props: GenericDepositInputHeaderProps) => {
  const { form, prizePool, tokenBalance, inputKey, tokenBalanceIsFetched } = props

  const { t } = useTranslation()
  const usersAddress = useUsersAddress()

  const { trigger, setValue } = form
  // const token = prizePoolTokens?.token
  // const usersBalances = usersBalancesData?.balances

  // If the user input a larger amount than their wallet balance before connecting a wallet
  useEffect(() => {
    trigger(inputKey)
  }, [usersAddress, tokenBalance])

  return (
    <div className='flex justify-between font-inter text-xs uppercase font-semibold text-pt-purple-dark text-opacity-60 dark:text-pt-purple-lighter mb-1'>
      <span className={classNames('')}>{t('amount')}</span>
      {usersAddress && (
        <button
          id='_setMaxDepositAmount'
          type='button'
          className='font-bold inline-flex items-center '
          disabled={!tokenBalance}
          onClick={(e) => {
            e.preventDefault()
            setValue(inputKey, tokenBalance.amount, { shouldValidate: true })
          }}
        >
          <img src={WalletIcon} className='mr-2' style={{ maxHeight: 12 }} />
          {!tokenBalanceIsFetched ? (
            <ThemedClipSpinner sizeClassName='w-3 h-3' className='mr-2 opacity-50' />
          ) : (
            <span className='mr-1'>{tokenBalance?.amountPretty || 0}</span>
          )}
          <span>{tokenBalance?.symbol}</span>
        </button>
      )}
    </div>
  )
}

interface DepositTokenProps extends GenericDepositAmountInputProps {}

const DepositToken = (props: DepositTokenProps) => {
  const { prizePool, tokenBalance } = props
  // const { data: prizePoolTokens } = usePrizePoolTokens(prizePool)
  // const token = prizePoolTokens?.token

  if (!tokenBalance) {
    return null
  }

  return (
    <div
      className={classNames(
        'flex items-center',
        'py-4 pl-8 pr-4',
        'placeholder-white placeholder-opacity-50'
      )}
    >
      <TokenIcon
        sizeClassName='w-6 h-6'
        className='mr-2'
        chainId={prizePool.chainId}
        address={tokenBalance.address}
      />
      <span className='font-bold'>{tokenBalance.symbol}</span>
    </div>
  )
}

interface InputProps extends GenericDepositAmountInputProps {}

const Input = (props: InputProps) => {
  const { form, inputKey, prizePool, tokenBalance } = props
  const { t } = useTranslation()

  const { register } = form

  const validate = useDepositValidationRules(tokenBalance, prizePool)

  const pattern = {
    value: /^\d*\.?\d*$/,
    message: t('pleaseEnterAPositiveNumber')
  }

  return (
    <input
      className={classNames(
        'bg-transparent w-full outline-none focus:outline-none active:outline-none text-right py-4 pr-8 pl-4 font-semibold'
        // 'rounded-lg'
      )}
      placeholder='0.0'
      {...register(inputKey, { required: true, pattern, validate })}
    />
  )
}

/**
 * Returns validation rules for the deposit input
 * @param prizePool
 * @returns
 */
const useDepositValidationRules = (tokenBalance, ticketBalance) => {
  const { t } = useTranslation()
  const usersAddress = useUsersAddress()
  // const { data: prizePoolTokens } = usePrizePoolTokens(prizePool)
  // const { data: usersBalancesData } = useUsersPrizePoolBalances(usersAddress, prizePool)

  // const token = prizePoolTokens?.token
  const decimals = tokenBalance?.decimals
  const minimumDepositAmount = useMinimumDepositAmount(tokenBalance)
  // const usersBalances = usersBalancesData?.balances
  // const tokenBalance = usersBalances?.token
  // const ticketBalance = usersBalances?.ticket

  return {
    isValid: (v: string) => {
      const isNotANumber = isNaN(Number(v))
      if (isNotANumber) return false
      if (!minimumDepositAmount) return false

      const quantityUnformatted = safeParseUnits(v, decimals)

      if (!!usersAddress) {
        if (!tokenBalance) return false
        if (!ticketBalance) return false
        if (quantityUnformatted && tokenBalance.amountUnformatted.lt(quantityUnformatted))
          return t(
            'insufficientFundsGetTokensBelow',
            'Insufficient funds. Get or swap tokens below.'
          )
      }

      if (getMaxPrecision(v) > Number(decimals)) return false
      if (quantityUnformatted && quantityUnformatted.isZero()) return false
      return true
    }
  }
}