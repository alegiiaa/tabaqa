import { useTx } from '../../lib/tx'
import type { Account } from '../../lib/api'
import { institution } from '../../lib/institutions'

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')

const DEFAULT_BANK = { name: ['Bank', 'بنك'] as [string, string], bg: 'linear-gradient(135deg,#27406b,#16243f)', accent: '#e9c46a' }
const DEFAULT_WALLET = { name: ['Wallet', 'محفظة'] as [string, string], bg: 'linear-gradient(135deg,#33415c,#1b2233)', accent: '#a9c4ff' }

// deterministic, fake last-4 from the account source (demo only — not a real PAN).
function last4(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return (h % 10000).toString().padStart(4, '0')
}

export function AccountCard({ account, holder }: { account: Account; holder: string }) {
  const { tx } = useTx()
  const isWallet = account.kind === 'wallet'
  // Brand theme from the shared institution registry; generic fallback otherwise.
  const inst = institution(account.provider)
  const p = inst
    ? { name: inst.name, bg: inst.bg, accent: inst.accent }
    : (isWallet ? DEFAULT_WALLET : DEFAULT_BANK)
  const SAR = tx('SAR', 'ر.س')

  return (
    <div className="paycard" style={{ background: p.bg }} dir="ltr">
      <div className="paycard-sheen" />
      <div className="paycard-row paycard-top">
        <div className="paycard-brand">
          <span className="paycard-name">{tx(p.name[0], p.name[1])}</span>
          <span className="paycard-kind">{isWallet ? tx('Wallet', 'محفظة') : tx('Bank account', 'حساب بنكي')}</span>
        </div>
        <span className="paycard-verified" title="Verified by Tabaqa">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
          Tabaqa
        </span>
      </div>

      <div className="paycard-row paycard-mid">
        <span className="paycard-chip" style={{ background: `linear-gradient(135deg,${p.accent},#b98a2e)` }} />
        <div className="paycard-mid-right">
          <svg className="paycard-wave" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M8 8a6 6 0 0 1 0 8M11.5 5.5a10 10 0 0 1 0 13M15 3a14 14 0 0 1 0 18" />
          </svg>
          <span className="paycard-network" style={{ color: p.accent }}>
            {isWallet ? tx('wallet', 'محفظة') : 'mada'}
          </span>
        </div>
      </div>

      <div className="paycard-pan">
        <span>••••</span><span>••••</span><span>••••</span><span>{last4(account.source)}</span>
      </div>

      <div className="paycard-row paycard-bot">
        <div className="paycard-holder">
          <span className="paycard-cap">{tx('Card holder', 'حامل البطاقة')}</span>
          <span className="paycard-holder-name">{holder}</span>
        </div>
        <div className="paycard-bal">
          <span className="paycard-cap">{tx('Balance', 'الرصيد')}</span>
          <span className="paycard-bal-num">{fmt(account.current_balance)} <small>{SAR}</small></span>
        </div>
      </div>
    </div>
  )
}
