// server.js - CommonJS version for Railway
const express = require("express");
const cors = require("cors");

// ✅ fetch polyfill for CommonJS (needed for CoinGecko API calls)
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();

app.use(
  cors({
    origin: "https://anoma-intent-wallet.vercel.app", // ✅ your Vercel frontend
    methods: ["GET", "POST"],
    credentials: true,
  })
);

app.use(express.json());

// In-memory demo store
const store = {
  users: {
    alice: {
      balances: {
        ETH: 100,
        BTC: 0.5,
        BNB: 2,
        SOL: 10,
        TRX: 500,
        USDT: 200,
        USDC: 150,
        XAN: 50,
      },
    },
    bob: {
      balances: {
        ETH: 50,
        BTC: 0.1,
        BNB: 1,
        SOL: 5,
        TRX: 200,
        USDT: 100,
        USDC: 75,
        XAN: 100,
      },
    },
  },
  txs: [],
  intents: [],
};

// ✅ Prices endpoint
app.get("/api/prices", async (req, res) => {
  try {
    const url =
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,binancecoin,solana,tron,tether,usd-coin&vs_currencies=usd";
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Error fetching prices:", err);
    res.status(500).json({ error: "Failed to fetch prices" });
  }
});

// ✅ Health check
app.get("/api/health", (req, res) =>
  res.json({ status: "ok", env: process.env.NODE_ENV || "dev" })
);

// ✅ Balance route
app.get("/api/balance", (req, res) => {
  const { user } = req.query;
  if (!user || !store.users[user])
    return res.status(400).json({ error: "Unknown user" });
  return res.json({ user, balances: store.users[user].balances });
});

app.get("/api/txs", (req, res) => res.json(store.txs));
app.get("/api/intents", (req, res) => res.json(store.intents));

// ✅ Faucet - top up all 8 tokens
app.get("/api/faucet", (req, res) => {
  const { user } = req.query;
  if (!user || !store.users[user])
    return res.status(400).json({ error: "Unknown user" });

  // Amounts to top-up per token (you can tweak these)
  const faucetAmounts = {
    ETH: 100,
    BTC: 0.05,
    BNB: 1,
    SOL: 5,
    TRX: 500,
    USDT: 200,
    USDC: 150,
    XAN: 100,
  };

  for (const token in faucetAmounts) {
    store.users[user].balances[token] =
      (store.users[user].balances[token] || 0) + faucetAmounts[token];
  }

  return res.json({ user, balances: store.users[user].balances });
});

// ✅ Send token
app.post("/api/send", (req, res) => {
  const { from, to, token, amount } = req.body;
  if (!store.users[from] || !store.users[to])
    return res.status(400).json({ error: "Invalid user" });
  if (typeof amount !== "number" || amount <= 0)
    return res.status(400).json({ error: "Invalid amount" });
  if (!store.users[from].balances[token] || store.users[from].balances[token] < amount) {
    return res.status(400).json({ error: "Insufficient balance" });
  }
  store.users[from].balances[token] -= amount;
  store.users[to].balances[token] += amount;
  const tx = {
    from,
    to,
    token,
    amount,
    time: new Date().toISOString(),
    type: "send",
  };
  store.txs.push(tx);
  return res.json({ tx, senderBalance: store.users[from] });
});

// ✅ Create intent
app.post("/api/intent", (req, res) => {
  const { maker, action, amount, from_asset, to_asset } = req.body;
  if (!store.users[maker]) return res.status(400).json({ error: "Invalid user" });
  if (typeof amount !== "number" || amount <= 0)
    return res.status(400).json({ error: "Invalid amount" });
  if (!store.users[maker].balances[from_asset] || store.users[maker].balances[from_asset] < amount) {
    return res.status(400).json({ error: "Insufficient balance" });
  }
  const intent = {
    maker,
    action,
    amount,
    from_asset,
    to_asset,
    status: "pending",
    time: new Date().toISOString(),
  };
  store.intents.push(intent);
  return res.json({ intent });
});

// ✅ Start server (Railway requires process.env.PORT)
const PORT = process.env.PORT || 4000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
