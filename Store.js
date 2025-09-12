// Simple in-memory store for balances and intents
const store = {
  users: {},   // Start empty, faucet will add balances
  intents: [],
  txs: []
};

module.exports = store;
