// matcher.js
const store = require('./store');

function now() { return Date.now(); }

function processSwapIntent(intent) {
  if (intent.status !== 'pending') return;
  if (intent.conditions && intent.conditions.expiry) {
    if (now() > new Date(intent.conditions.expiry).getTime()) {
      intent.status = 'expired';
      intent.note = 'Expired before match';
      return;
    }
  }

  const user = store.users[intent.maker];
  if (!user) { intent.status = 'failed'; intent.note = 'Maker not found'; return; }

  const from = intent.from_asset;
  const to = intent.to_asset;
  const amount = Number(intent.amount);

  // simple fixed-rate matching (ETH <-> XAN)
  let rate = null;
  if (from === 'ETH' && to === 'XAN') rate = store.rates.ETH_TO_XAN;
  else if (from === 'XAN' && to === 'ETH') rate = store.rates.XAN_TO_ETH;
  else { intent.status = 'failed'; intent.note = 'Unsupported pair'; return; }

  if ((user.balances[from] || 0) < amount) { intent.status = 'failed'; intent.note = 'Insufficient funds'; return; }

  const received = amount * rate; // simple math
  const minReceive = Number(intent.conditions?.min_receive || 0);

  // check pool liquidity
  if ((store.pool[to] || 0) < received) {
    intent.status = 'failed';
    intent.note = 'Pool liquidity insufficient';
    return;
  }

  if (received < minReceive) {
    // not satisfying price condition — leave pending for now
    return;
  }

  // execute: debit user from, credit user to, update pool
  user.balances[from] = (user.balances[from] || 0) - amount;
  user.balances[to] = (user.balances[to] || 0) + received;
  store.pool[from] = (store.pool[from] || 0) + amount;
  store.pool[to] = (store.pool[to] || 0) - received;

  intent.status = 'fulfilled';
  intent.executed_at = new Date().toISOString();
  const tx = {
    id: 'tx_' + Math.random().toString(36).slice(2,9),
    maker: intent.maker,
    from, to, amount, received,
    intent_id: intent.id,
    ts: new Date().toISOString()
  };
  store.txs.push(tx);
  intent.tx = tx;
}

function runMatcher() {
  setInterval(() => {
    for (const intent of store.intents) {
      try {
        if (intent.action === 'swap') processSwapIntent(intent);
      } catch (e) {
        console.error('matcher error', e);
      }
    }
  }, 2000);
}

module.exports = { runMatcher };
