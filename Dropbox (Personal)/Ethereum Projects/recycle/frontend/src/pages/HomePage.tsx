import { Link } from 'react-router-dom';

const TURING_TOKEN = '0xe8001DC781B66D5ccb189AC0429978fc48c6cf5E';

export function HomePage() {
  return (
    <main style={{
      maxWidth: 640,
      margin: '0 auto',
      padding: '18vh 2rem 14vh',
    }}>
      {/* Identity */}
      <p style={{
        fontSize: '0.68rem',
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        color: '#aaa',
        marginBottom: '6vh',
        opacity: 0,
        animation: 'up 0.9s cubic-bezier(0.23,1,0.32,1) forwards',
      }}>
        Protocol
      </p>

      {/* Mission */}
      <h1 style={{
        fontSize: 'clamp(1.5rem, 4.5vw, 2.1rem)',
        fontWeight: 300,
        lineHeight: 1.45,
        marginBottom: '2.5rem',
        maxWidth: 560,
        opacity: 0,
        animation: 'up 0.9s cubic-bezier(0.23,1,0.32,1) 0.08s forwards',
      }}>
        A token that asks you to prove you're{' '}
        <span className="font-human">human</span>{' '}
        every day — or watch your balance{' '}
        <span className="font-machine">decay</span>.
      </h1>

      {/* About */}
      <p style={{
        fontSize: '0.92rem',
        color: '#666',
        lineHeight: 1.75,
        maxWidth: 460,
        marginBottom: '6vh',
        opacity: 0,
        animation: 'up 0.9s cubic-bezier(0.23,1,0.32,1) 0.16s forwards',
      }}>
        TURING is a deflationary token. Each day, an{' '}
        <span className="font-machine">AI</span>{' '}
        asks you a question. Answer like a{' '}
        <span className="font-human">human</span>{' '}
        and your balance is safe. Miss a day and 0.5% vanishes — forever.
      </p>

      {/* Divider */}
      <div style={{
        height: 1,
        background: '#e0e0e0',
        marginBottom: '3.5rem',
        opacity: 0,
        animation: 'up 0.9s cubic-bezier(0.23,1,0.32,1) 0.24s forwards',
      }} />

      {/* How it works */}
      <p style={{
        fontSize: '0.68rem',
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: '#aaa',
        marginBottom: '2rem',
        opacity: 0,
        animation: 'up 0.9s cubic-bezier(0.23,1,0.32,1) 0.28s forwards',
      }}>
        How it works
      </p>

      <div style={{
        opacity: 0,
        animation: 'up 0.9s cubic-bezier(0.23,1,0.32,1) 0.34s forwards',
      }}>
        {[
          {
            num: '01',
            title: 'Buy',
            desc: 'Acquire TURING tokens through the Uniswap V4 pool. A 10% swap tax feeds the treasury.',
          },
          {
            num: '02',
            title: 'Prove',
            desc: 'Each day, answer one question. An AI analyzes your response and your typing patterns to verify you\'re human.',
          },
          {
            num: '03',
            title: 'Hold',
            desc: 'Check in daily and your balance stays intact. Miss a day and 0.5% of your tokens burn — permanently reducing supply.',
          },
          {
            num: '04',
            title: 'Redeem',
            desc: 'Burn your tokens at any time for a pro-rata share of the ETH treasury. Every token has a floor price backed by real ETH.',
          },
        ].map((step, i) => (
          <div key={step.num} style={{
            borderTop: '1px solid #eee',
            padding: '1.6rem 0',
            display: 'flex',
            gap: '1.2rem',
            alignItems: 'baseline',
            ...(i === 3 ? { borderBottom: '1px solid #eee' } : {}),
          }}>
            <span className="font-machine" style={{
              fontSize: '0.68rem',
              color: '#ccc',
              minWidth: '1.4rem',
            }}>
              {step.num}
            </span>
            <div>
              <p style={{ fontSize: '1.05rem', fontWeight: 400, marginBottom: '0.4rem' }}>
                {step.title}
              </p>
              <p style={{ fontSize: '0.85rem', color: '#666', lineHeight: 1.65, maxWidth: 400 }}>
                {step.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Tokenomics */}
      <div style={{
        marginTop: '6vh',
        opacity: 0,
        animation: 'up 0.9s cubic-bezier(0.23,1,0.32,1) 0.42s forwards',
      }}>
        <p style={{
          fontSize: '0.68rem',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: '#aaa',
          marginBottom: '2rem',
        }}>
          Tokenomics
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1.5rem',
          maxWidth: 420,
        }}>
          {[
            { label: 'Total supply', value: '1B' },
            { label: 'Daily decay', value: '0.5%' },
            { label: 'Swap tax', value: '10%' },
            { label: 'To treasury', value: '9%' },
            { label: 'To team', value: '1%' },
            { label: 'Redemption', value: 'Pro-rata ETH' },
          ].map((item) => (
            <div key={item.label}>
              <p className="font-machine" style={{
                fontSize: '1.1rem',
                fontWeight: 500,
                marginBottom: '0.2rem',
              }}>
                {item.value}
              </p>
              <p style={{
                fontSize: '0.72rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#aaa',
              }}>
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* CTAs */}
      <div style={{
        marginTop: '8vh',
        display: 'flex',
        gap: '1rem',
        flexWrap: 'wrap',
        opacity: 0,
        animation: 'up 0.9s cubic-bezier(0.23,1,0.32,1) 0.5s forwards',
      }}>
        <Link to="/swap" style={{
          display: 'inline-block',
          padding: '0.75rem 2rem',
          background: '#111',
          color: '#fff',
          fontSize: '0.78rem',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          textDecoration: 'none',
          borderRadius: 2,
          transition: 'background 0.2s',
        }}>
          Buy TURING
        </Link>
        <Link to="/checkin" style={{
          display: 'inline-block',
          padding: '0.75rem 2rem',
          background: '#fff',
          color: '#111',
          fontSize: '0.78rem',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          textDecoration: 'none',
          borderRadius: 2,
          border: '1px solid #ddd',
          transition: 'all 0.2s',
        }}>
          Begin check-in
        </Link>
      </div>

      {/* Contract info */}
      <div style={{
        marginTop: '6vh',
        opacity: 0,
        animation: 'up 0.9s cubic-bezier(0.23,1,0.32,1) 0.56s forwards',
      }}>
        <p style={{
          fontSize: '0.68rem',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: '#aaa',
          marginBottom: '1.2rem',
        }}>
          Contract
        </p>

        <a
          href={`https://etherscan.io/token/${TURING_TOKEN}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-machine"
          style={{ fontSize: '0.72rem', color: '#999' }}
        >
          {TURING_TOKEN}
        </a>
      </div>

      {/* Evolving experiment note */}
      <p style={{
        marginTop: '6vh',
        fontSize: '0.78rem',
        color: '#999',
        lineHeight: 1.7,
        maxWidth: 460,
        fontStyle: 'italic',
        opacity: 0,
        animation: 'up 0.9s cubic-bezier(0.23,1,0.32,1) 0.66s forwards',
      }}>
        TURING is an evolving experiment. The AI that determines your humanity is not
        static — it learns, adapts, and evolves over time. What proves you're human today
        may change tomorrow.
      </p>

      {/* Footer */}
      <footer style={{
        marginTop: '4vh',
        fontSize: '0.72rem',
        color: '#ddd',
        display: 'flex',
        gap: '1.5rem',
        opacity: 0,
        animation: 'up 0.9s cubic-bezier(0.23,1,0.32,1) 0.72s forwards',
      }}>
        <a href="https://boundarylabs.fun" style={{ color: '#ccc' }}>
          Boundary Labs
        </a>
        <a href="https://github.com/0xDigitalOil" target="_blank" rel="noopener noreferrer" style={{ color: '#ccc' }}>
          GitHub
        </a>
      </footer>
    </main>
  );
}
