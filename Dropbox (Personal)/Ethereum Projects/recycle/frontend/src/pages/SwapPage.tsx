import { useState, useCallback, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useBalance } from 'wagmi';
import { parseEther, formatEther, encodeAbiParameters, encodePacked } from 'viem';
import { Link } from 'react-router-dom';
import { useEthPrice } from '../hooks/useEthPrice';

const UNIVERSAL_ROUTER = '0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af' as `0x${string}`;
const TURING_TOKEN = '0xe8001DC781B66D5ccb189AC0429978fc48c6cf5E' as `0x${string}`;
const HOOK = '0xe02B0b5739E7C64f41d3295c191635E680bE40C4' as `0x${string}`;
const ETH_ADDR = '0x0000000000000000000000000000000000000000' as `0x${string}`;

const ROUTER_ABI = [
  {
    name: 'execute',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'commands', type: 'bytes' },
      { name: 'inputs', type: 'bytes[]' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

const poolKeyType = {
  type: 'tuple' as const,
  components: [
    { type: 'address' as const },
    { type: 'address' as const },
    { type: 'uint24' as const },
    { type: 'int24' as const },
    { type: 'address' as const },
  ],
};

const POOL_KEY: [`0x${string}`, `0x${string}`, number, number, `0x${string}`] =
  [ETH_ADDR, TURING_TOKEN, 0, 10, HOOK];

function buildBuyCalldata(amountIn: bigint) {
  // Actions: SWAP_EXACT_IN_SINGLE(0x06) + SETTLE_ALL(0x0c) + TAKE_ALL(0x0f)
  const actions = encodePacked(
    ['uint8', 'uint8', 'uint8'],
    [0x06, 0x0c, 0x0f]
  );

  // ExactInputSingleParams: (PoolKey, bool zeroForOne, uint128 amountIn, uint128 amountOutMin, bytes hookData)
  const swapParam = encodeAbiParameters(
    [
      poolKeyType,
      { type: 'bool' },
      { type: 'uint128' },
      { type: 'uint128' },
      { type: 'bytes' },
    ],
    [POOL_KEY, true, amountIn, 0n, '0x']
  );

  // SETTLE_ALL: (Currency, uint256 maxAmount)
  const settleParam = encodeAbiParameters(
    [{ type: 'address' }, { type: 'uint256' }],
    [ETH_ADDR, amountIn]
  );

  // TAKE_ALL: (Currency, uint256 minAmount)
  const takeParam = encodeAbiParameters(
    [{ type: 'address' }, { type: 'uint256' }],
    [TURING_TOKEN, 0n]
  );

  // V4_SWAP input: abi.encode(bytes actions, bytes[] params)
  const v4Input = encodeAbiParameters(
    [{ type: 'bytes' }, { type: 'bytes[]' }],
    [actions, [swapParam, settleParam, takeParam]]
  );

  // Command: V4_SWAP (0x10)
  const commands = encodePacked(['uint8'], [0x10]);

  return { commands, inputs: [v4Input] as readonly `0x${string}`[] };
}

export function SwapPage() {
  const { address, isConnected } = useAccount();
  const { data: ethBalance } = useBalance({ address });
  const ethPrice = useEthPrice();
  const [amount, setAmount] = useState('');
  const { data: hash, writeContract, isPending, error, reset } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const ethNum = amount ? parseFloat(amount) : 0;
  const estimated = ethNum > 0 ? ethNum * 900_000 : 0;

  const handleSwap = useCallback(() => {
    if (!amount || ethNum <= 0) return;
    const amountIn = parseEther(amount);
    const { commands, inputs } = buildBuyCalldata(amountIn);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800);

    writeContract({
      address: UNIVERSAL_ROUTER,
      abi: ROUTER_ABI,
      functionName: 'execute',
      args: [commands, inputs, deadline],
      value: amountIn,
    });
  }, [amount, ethNum, writeContract]);

  useEffect(() => {
    if (isSuccess) {
      const t = setTimeout(() => { setAmount(''); reset(); }, 15000);
      return () => clearTimeout(t);
    }
  }, [isSuccess, reset]);

  const containerStyle: React.CSSProperties = {
    maxWidth: 480,
    margin: '0 auto',
    padding: '18vh 2rem 14vh',
  };

  if (!isConnected) {
    return (
      <main style={containerStyle}>
        <div style={{ opacity: 0, animation: 'up 0.9s cubic-bezier(0.23,1,0.32,1) forwards' }}>
          <p style={{ fontSize: '0.68rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#aaa', marginBottom: '3rem' }}>
            Swap
          </p>
          <p style={{ fontSize: 'clamp(1.2rem, 3vw, 1.6rem)', fontWeight: 300, lineHeight: 1.5, color: '#666' }}>
            Connect your wallet to buy{' '}
            <span className="font-machine">TURING</span> tokens.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main style={containerStyle}>
      <div style={{ opacity: 0, animation: 'up 0.9s cubic-bezier(0.23,1,0.32,1) forwards' }}>
        <p style={{ fontSize: '0.68rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#aaa', marginBottom: '2rem' }}>
          Buy TURING
        </p>
      </div>

      <div style={{ opacity: 0, animation: 'up 0.9s cubic-bezier(0.23,1,0.32,1) 0.08s forwards' }}>
        {/* You pay */}
        <div style={{ padding: '1.5rem', background: '#fafafa', borderRadius: 4, marginBottom: '0.5rem' }}>
          <p style={{ fontSize: '0.68rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#aaa', marginBottom: '0.8rem' }}>
            You pay
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                if (/^[0-9]*\.?[0-9]*$/.test(e.target.value)) setAmount(e.target.value);
              }}
              placeholder="0.0"
              style={{
                flex: 1, border: 'none', outline: 'none',
                fontSize: '1.4rem', fontFamily: "'IBM Plex Mono', monospace",
                background: 'transparent', color: '#111',
              }}
            />
            <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#555' }}>ETH</span>
          </div>
          {ethBalance && (
            <p style={{ fontSize: '0.68rem', color: '#bbb', marginTop: '0.5rem' }}>
              Balance: {parseFloat(formatEther(ethBalance.value)).toFixed(4)} ETH
              {ethPrice > 0 && ` ($${(parseFloat(formatEther(ethBalance.value)) * ethPrice).toFixed(2)})`}
              <button
                onClick={() => {
                  const max = ethBalance.value - parseEther('0.005');
                  if (max > 0n) setAmount(formatEther(max));
                }}
                style={{
                  marginLeft: '0.5rem', background: 'none',
                  border: '1px solid #ddd', borderRadius: 2,
                  fontSize: '0.6rem', letterSpacing: '0.08em',
                  textTransform: 'uppercase', color: '#aaa',
                  cursor: 'pointer', padding: '0.15rem 0.4rem',
                }}
              >
                Max
              </button>
            </p>
          )}
        </div>

        {/* Arrow */}
        <div style={{ textAlign: 'center', margin: '-0.2rem 0', position: 'relative', zIndex: 1 }}>
          <span style={{
            display: 'inline-block', width: 28, height: 28,
            lineHeight: '28px', textAlign: 'center',
            background: '#fff', border: '1px solid #eee',
            borderRadius: '50%', fontSize: '0.75rem', color: '#aaa',
          }}>
            ↓
          </span>
        </div>

        {/* You receive */}
        <div style={{ padding: '1.5rem', background: '#fafafa', borderRadius: 4, marginBottom: '1.5rem' }}>
          <p style={{ fontSize: '0.68rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#aaa', marginBottom: '0.8rem' }}>
            You receive (estimate)
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <span className="font-machine" style={{ flex: 1, fontSize: '1.4rem', color: estimated > 0 ? '#111' : '#ccc' }}>
              {estimated > 0 ? fmtNum(estimated) : '0.0'}
            </span>
            <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#555' }}>TURING</span>
          </div>
          <p style={{ fontSize: '0.62rem', color: '#bbb', marginTop: '0.5rem' }}>
            ~1M TURING/ETH · 10% swap tax (9% treasury, 1% team)
            {ethNum > 0 && ethPrice > 0 && <><br />${(ethNum * ethPrice).toFixed(2)} value</>}
          </p>
        </div>

        {/* Swap button */}
        <button
          onClick={handleSwap}
          disabled={ethNum <= 0 || isPending || confirming}
          style={{
            width: '100%', padding: '0.85rem',
            background: ethNum > 0 && !isPending && !confirming ? '#111' : '#e5e5e5',
            color: ethNum > 0 && !isPending && !confirming ? '#fff' : '#bbb',
            border: 'none', fontSize: '0.78rem',
            letterSpacing: '0.1em', textTransform: 'uppercase',
            cursor: ethNum > 0 && !isPending && !confirming ? 'pointer' : 'default',
            borderRadius: 2, transition: 'all 0.2s',
          }}
        >
          {isPending ? 'Confirm in wallet...' : confirming ? 'Confirming...' : 'Buy TURING'}
        </button>

        {/* Success */}
        {isSuccess && hash && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: '#f0faf3', borderRadius: 4 }}>
            <p style={{ fontSize: '0.78rem', color: '#2d8a4e', marginBottom: '0.4rem' }}>
              Swap confirmed!
            </p>
            <a
              href={`https://etherscan.io/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-machine"
              style={{ fontSize: '0.68rem', color: '#2d8a4e' }}
            >
              {hash.slice(0, 14)}...{hash.slice(-8)}
            </a>
          </div>
        )}

        {/* Error */}
        {error && (
          <p style={{ fontSize: '0.78rem', color: '#c0392b', marginTop: '1rem' }}>
            {error.message?.includes('User rejected') || error.message?.includes('denied')
              ? 'Transaction rejected.'
              : (error.message?.slice(0, 120) || 'Swap failed.')}
          </p>
        )}
      </div>

      {/* Info */}
      <div style={{ marginTop: '3rem', opacity: 0, animation: 'up 0.9s cubic-bezier(0.23,1,0.32,1) 0.2s forwards' }}>
        <div style={{ height: 1, background: '#eee', marginBottom: '2rem' }} />
        <p style={{ fontSize: '0.78rem', color: '#aaa', lineHeight: 1.7, marginBottom: '1rem' }}>
          Swaps execute through the Uniswap V4 pool. A 10% swap tax feeds the ETH treasury (9%) and team (1%).
        </p>
        <p style={{ fontSize: '0.78rem', color: '#aaa', lineHeight: 1.7 }}>
          To sell, use{' '}
          <Link to="/dashboard" style={{ color: '#888', textDecoration: 'underline' }}>
            Redeem
          </Link>
          {' '}on the Dashboard — burn tokens for your pro-rata share of the ETH treasury (no swap tax).
        </p>
      </div>
    </main>
  );
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(2) + 'K';
  return n.toFixed(2);
}
