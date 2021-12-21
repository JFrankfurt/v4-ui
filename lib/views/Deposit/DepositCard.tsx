import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import FeatherIcon from 'feather-icons-react'
import {
  Amount,
  Token,
  Transaction,
  useTransaction,
  useIsWalletMetamask
} from '@pooltogether/hooks'
import { PrizePool } from '@pooltogether/v4-js-client'
import { useRouter } from 'next/router'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useOnboard } from '@pooltogether/bnc-onboard-hooks'
import { SquareLink, TokenIcon } from '@pooltogether/react-components'
import {
  AddTokenToMetamaskButton,
  SquareButton,
  SquareButtonTheme,
  SquareButtonSize
} from '@pooltogether/react-components'
import { ethers, Overrides } from 'ethers'

import { BridgeTokensModal } from 'lib/components/Modal/BridgeTokensModal'
import { SwapTokensModal } from 'lib/components/Modal/SwapTokensModal'
import { SelectAppChainIdModal } from 'lib/components/SelectAppChainIdModal'
import { getAmountFromString } from 'lib/utils/getAmountFromString'
import { useIsWalletOnNetwork } from 'lib/hooks/useIsWalletOnNetwork'
import { useSelectedChainIdUser } from 'lib/hooks/Tsunami/User/useSelectedChainIdUser'
import { usePrizePoolTokens } from 'lib/hooks/Tsunami/PrizePool/usePrizePoolTokens'
import { usePrizePoolBySelectedChainId } from 'lib/hooks/Tsunami/PrizePool/usePrizePoolBySelectedChainId'
import { useUsersDepositAllowance } from 'lib/hooks/Tsunami/PrizePool/useUsersDepositAllowance'
import { useUsersPrizePoolBalances } from 'lib/hooks/Tsunami/PrizePool/useUsersPrizePoolBalances'
import { useSendTransaction } from 'lib/hooks/useSendTransaction'
import { DepositConfirmationModal } from 'lib/views/Deposit/DepositConfirmationModal'
import { DepositForm, DEPOSIT_QUANTITY_KEY } from 'lib/views/Deposit/DepositForm'
import { TxHashRow } from 'lib/components/TxHashRow'
import { useUsersTicketDelegate } from 'lib/hooks/Tsunami/PrizePool/useUsersTicketDelegate'

import SuccessBalloonsSvg from 'assets/images/success.svg'
import { useUsersAddress } from 'lib/hooks/useUsersAddress'

const BUTTON_MIN_WIDTH = 100

export const DepositCard = (props: { className?: string }) => {
  const { className } = props

  const router = useRouter()

  const prizePool = usePrizePoolBySelectedChainId()
  const usersAddress = useUsersAddress()
  const user = useSelectedChainIdUser()
  const { data: prizePoolTokens, isFetched: isPrizePoolTokensFetched } =
    usePrizePoolTokens(prizePool)
  const {
    data: usersBalancesData,
    refetch: refetchUsersBalances,
    isFetched: isUsersBalancesFetched
  } = useUsersPrizePoolBalances(usersAddress, prizePool)
  const usersBalances = usersBalancesData?.balances
  const {
    data: depositAllowance,
    refetch: refetchUsersDepositAllowance,
    isFetched: isUsersDepositAllowanceFetched
  } = useUsersDepositAllowance({
    prizePoolAddress: prizePool?.id(),
    getUsersDepositAllowanceFxn: prizePool.getUsersDepositAllowance(usersAddress)
  })
  const {
    data: delegateData,
    isFetched: isTicketDelegateFetched,
    isFetching: isTicketDelegateFetching,
    refetch: refetchTicketDelegate
  } = useUsersTicketDelegate(usersAddress, prizePool)

  const isDataFetched =
    isPrizePoolTokensFetched &&
    isUsersBalancesFetched &&
    isUsersDepositAllowanceFetched &&
    usersBalancesData.usersAddress === usersAddress &&
    (isTicketDelegateFetched || !isTicketDelegateFetching)

  const ticketDelegate = delegateData?.[usersAddress]

  const form = useForm({
    mode: 'onChange',
    reValidateMode: 'onChange'
  })

  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false)

  const { t } = useTranslation()

  const sendTx = useSendTransaction()

  const [depositedAmount, setDepositedAmount] = useState<Amount>()

  const [transactionIds, setTransactionIds] = useState<{ [txIdKey: string]: number }>({})
  const getKey = (prizePool: PrizePool, action: string) => `${prizePool?.id()}-${action}`

  const approveTxId = transactionIds?.[getKey(prizePool, 'approve')] || 0
  const depositTxId = transactionIds?.[getKey(prizePool, 'deposit')] || 0
  const completedDepositTxId = transactionIds?.[getKey(prizePool, 'completed-deposit')] || 0

  const approveTx = useTransaction(approveTxId)
  const depositTx = useTransaction(depositTxId)
  const completedDepositTx = useTransaction(completedDepositTxId)

  const setSpecificTxId = (txId: number, prizePool: PrizePool, action: string) =>
    setTransactionIds((prevState) => ({ ...prevState, [getKey(prizePool, action)]: txId }))
  const setApproveTxId = (txId: number, prizePool: PrizePool) =>
    setSpecificTxId(txId, prizePool, 'approve')
  const setDepositTxId = (txId: number, prizePool: PrizePool) =>
    setSpecificTxId(txId, prizePool, 'deposit')
  const setCompletedDepositTxId = (txId: number, prizePool: PrizePool) =>
    setSpecificTxId(txId, prizePool, 'completed-deposit')

  const token = prizePoolTokens?.token
  const ticket = prizePoolTokens?.ticket
  const tokenBalance = usersBalances?.token
  const ticketBalance = usersBalances?.ticket

  const { setValue, watch, reset } = form

  const quantity = watch(DEPOSIT_QUANTITY_KEY)
  const amountToDeposit = useMemo(
    () => getAmountFromString(quantity, token?.decimals),
    [quantity, token?.decimals]
  )

  // Set quantity from the query parameter on mount
  useEffect(() => {
    try {
      const quantity = router.query[DEPOSIT_QUANTITY_KEY]
      const quantityNum = Number(quantity)
      if (quantity && !isNaN(quantityNum)) {
        setValue(DEPOSIT_QUANTITY_KEY, quantity, { shouldValidate: true })
      }
    } catch (e) {
      console.warn('Invalid query parameter for quantity')
    }
  }, [])

  const closeModal = () => {
    const { query, pathname } = router
    delete query.showConfirmModal
    router.replace({ pathname, query }, null, { scroll: false })
    setShowConfirmModal(false)
  }

  const sendApproveTx = async () => {
    const name = t(`allowTickerPool`, { ticker: token.symbol })
    const txId = await sendTx({
      name,
      method: 'approve',
      callTransaction: async () => user.approveDeposits(),
      callbacks: {
        refetch: () => refetchUsersDepositAllowance()
      }
    })
    setApproveTxId(txId, prizePool)
  }

  const onSuccess = (tx: Transaction) => {
    setDepositedAmount(amountToDeposit)
    setCompletedDepositTxId(tx.id, prizePool)
    setDepositTxId(0, prizePool)
    closeModal()
    resetQueryParam()
    refetchTicketDelegate()
  }

  const sendDepositTx = async () => {
    const name = `${t('deposit')} ${amountToDeposit.amountPretty} ${token.symbol}`
    const overrides: Overrides = { gasLimit: 750000 }
    let contractMethod
    let callTransaction
    if (ticketDelegate === ethers.constants.AddressZero) {
      contractMethod = 'depositToAndDelegate'
      callTransaction = async () =>
        user.depositAndDelegate(amountToDeposit.amountUnformatted, usersAddress, overrides)
    } else {
      contractMethod = 'depositTo'
      callTransaction = async () => user.deposit(amountToDeposit.amountUnformatted, overrides)
    }

    const txId = await sendTx({
      name,
      method: contractMethod,
      callTransaction,
      callbacks: {
        onSuccess,
        refetch: () => {
          refetchUsersBalances()
        }
      }
    })
    setDepositTxId(txId, prizePool)
  }

  const resetQueryParam = () => {
    const { query, pathname } = router
    delete query[DEPOSIT_QUANTITY_KEY]
    router.replace({ pathname, query }, null, { scroll: false })
  }

  const resetState = () => {
    resetQueryParam()
    reset()
    setApproveTxId(0, prizePool)
    setDepositTxId(0, prizePool)
    setCompletedDepositTxId(0, prizePool)
    setDepositedAmount(undefined)
  }

  return (
    <>
      <div className={className}>
        <div className='font-semibold font-inter flex items-center justify-center text-xs xs:text-sm sm:text-lg mb-2 mt-4'>
          {t('depositOn', 'Deposit on')}
          <SelectAppChainIdModal className='network-dropdown ml-1 xs:ml-2' />
        </div>
        <DepositForm
          form={form}
          user={user}
          prizePool={prizePool}
          token={token}
          ticket={ticket}
          isPrizePoolTokensFetched={isPrizePoolTokensFetched}
          approveTx={approveTx}
          depositTx={depositTx}
          isUsersBalancesFetched={isUsersBalancesFetched}
          tokenBalance={tokenBalance}
          ticketBalance={ticketBalance}
          isUsersDepositAllowanceFetched={isUsersDepositAllowanceFetched}
          setShowConfirmModal={setShowConfirmModal}
          amountToDeposit={amountToDeposit}
        />

        <div className='w-full flex justify-around px-2 py-4'>
          <BridgeTokensModalTrigger prizePool={prizePool} />
          <HelpLink />
          <SwapTokensModalTrigger prizePool={prizePool} />
        </div>
      </div>

      <DepositConfirmationModal
        isOpen={showConfirmModal}
        closeModal={closeModal}
        label='deposit confirmation modal'
        token={token}
        ticket={ticket}
        isDataFetched={isDataFetched}
        amountToDeposit={amountToDeposit}
        depositAllowance={depositAllowance}
        approveTx={approveTx}
        depositTx={depositTx}
        sendApproveTx={sendApproveTx}
        sendDepositTx={sendDepositTx}
        prizePool={prizePool}
        resetState={resetState}
      />
    </>
  )
}

const HelpLink = () => {
  const { t } = useTranslation()

  return (
    <a
      href='https://docs.pooltogether.com/how-to/how-to-deposit'
      target='_blank'
      rel='noreferrer noopener'
      className='text-center text-xs text-inverse opacity-70 hover:opacity-100 transition-opacity xs:-ml-3'
      style={{ minWidth: BUTTON_MIN_WIDTH }}
    >
      <FeatherIcon
        icon={'help-circle'}
        className='relative w-4 h-4 mr-2 inline-block'
        style={{ top: -2 }}
      />

      {t('help', 'Help')}
    </a>
  )
}

interface ExternalLinkProps {
  prizePool: PrizePool
}

const SwapTokensModalTrigger = (props: ExternalLinkProps) => {
  const { prizePool } = props
  const [showModal, setShowModal] = useState(false)
  const { data: tokens } = usePrizePoolTokens(prizePool)

  const { t } = useTranslation()

  return (
    <>
      <button
        className='text-center text-inverse opacity-70 hover:opacity-100 transition-opacity'
        onClick={() => setShowModal(true)}
        style={{ minWidth: BUTTON_MIN_WIDTH }}
      >
        <FeatherIcon
          icon={'refresh-cw'}
          className='relative w-4 h-4 mr-1 inline-block'
          style={{ left: -2, top: -2 }}
        />{' '}
        {t('swapTokens', 'Swap tokens')}
      </button>
      <SwapTokensModal
        label={t('decentralizedExchangeModal', 'Decentralized exchange - modal')}
        chainId={prizePool.chainId}
        tokenAddress={tokens?.token.address}
        isOpen={showModal}
        closeModal={() => setShowModal(false)}
      />
    </>
  )
}
const BridgeTokensModalTrigger = (props: ExternalLinkProps) => {
  const { prizePool } = props
  const [showModal, setShowModal] = useState(false)

  const { t } = useTranslation()

  return (
    <>
      <button
        className='text-center text-inverse opacity-70 hover:opacity-100 transition-opacity'
        onClick={() => setShowModal(true)}
        style={{ minWidth: BUTTON_MIN_WIDTH }}
      >
        <FeatherIcon
          icon={'arrow-left'}
          className='relative w-3 h-3  inline-block'
          style={{ top: -2 }}
        />
        <FeatherIcon
          icon={'arrow-right'}
          className='relative w-3 h-3 mr-1 inline-block'
          style={{ top: -2, left: -5 }}
        />

        {t('bridgeTokens', 'Bridge tokens')}
      </button>
      <BridgeTokensModal
        label={t('ethToL2BridgeModal', 'Ethereum to L2 bridge - modal')}
        chainId={prizePool.chainId}
        isOpen={showModal}
        closeModal={() => setShowModal(false)}
      />
    </>
  )
}

const SuccessBalloons = (props) => (
  <img
    src={SuccessBalloonsSvg}
    alt='success balloons graphic'
    width={64}
    className={props.className}
  />
)

interface CompletedDepositProps {
  chainId: number
  resetState: () => void
  depositedAmount: Amount
  tx: Transaction
  token: Token
  ticket: Token
}

const CompletedDeposit = (props: CompletedDepositProps) => {
  const { resetState, depositedAmount, tx, token, chainId } = props
  const { t } = useTranslation()
  const router = useRouter()

  return (
    <div className='flex flex-col py-4'>
      <SuccessBalloons className='mx-auto mb-6' />

      <div className='leading-tight mb-4 text-inverse'>
        <p className='font-inter max-w-xs mx-auto opacity-80 text-center text-xl'>
          {t('successfullyDeposited', {
            amount: depositedAmount.amountPretty,
            ticker: token.symbol
          })}
        </p>
        <p className='font-inter font-semibold max-w-xs mx-auto text-center text-3xl mb-4'>
          {depositedAmount.amountPretty} {token.symbol}
        </p>

        <DepositAddTokenButton {...props} />
      </div>

      <div className={'w-full px-4 py-2 bg-light-purple-10 rounded-lg text-accent-1'}>
        <TxHashRow depositTx={tx} chainId={chainId} />
      </div>
      <div className='w-full font-semibold font-inter gradient-new text-center px-2 xs:px-8 py-2 my-4 text-xs rounded-lg text-inverse'>
        {t(
          'disclaimerComeBackRegularlyToClaimWinnings',
          'You are eligible for all future prizes! Come back to check for winnings, if you don’t claim winnings in 60 days they will expire. <Link>Learn more</Link>'
        )}
        <br />
        <a
          href='https://docs.pooltogether.com/faq/prizes-and-winning'
          target='_blank'
          rel='noopener noreferrer'
          className='underline text-xs'
        >
          {t('learnMore', 'Learn more')}
        </a>
      </div>

      <SquareButton
        size={SquareButtonSize.md}
        theme={SquareButtonTheme.tealOutline}
        className='text-xl hover:text-inverse transition-colors mb-2'
        onClick={resetState}
      >
        {t('depositMore', 'Deposit more')}
      </SquareButton>
      <Link href={{ pathname: '/account', query: router.query }}>
        <SquareLink
          size={SquareButtonSize.sm}
          theme={SquareButtonTheme.purpleOutline}
          className='text-xs hover:text-inverse transition-colors text-center'
        >
          {t('viewAccount', 'View account')}
        </SquareLink>
      </Link>
    </div>
  )
}

const DepositAddTokenButton = (props) => {
  const { ticket, chainId } = props
  const { t } = useTranslation()

  const { wallet } = useOnboard()
  const isMetaMask = useIsWalletMetamask(wallet)
  const isWalletOnProperNetwork = useIsWalletOnNetwork(chainId)

  if (!isMetaMask) {
    return null
  }

  return (
    <AddTokenToMetamaskButton
      t={t}
      isWalletOnProperNetwork={isWalletOnProperNetwork}
      token={ticket}
      chainId={chainId}
      className='underline trans text-green hover:opacity-90 cursor-pointer flex items-center text-center font-semibold mx-auto'
    >
      <TokenIcon
        sizeClassName={'w-5 xs:w-6 h-5 xs:h-6'}
        className='mr-2'
        chainId={chainId}
        address={ticket.address}
      />{' '}
      {t('addTicketTokenToMetamask', {
        token: ticket.symbol
      })}{' '}
    </AddTokenToMetamaskButton>
  )
}
