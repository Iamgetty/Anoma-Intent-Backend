// server.js - CommonJS version for Railway
const express = require("express");
const cors = require("cors");

const app = express();

// CORS: allow your deployed frontend on Vercel
app.use(
  cors({
    origin: "https://anoma-intent-wallet.vercel.app",
    methods: ["GET", "POST"],
    credentials: true,
  })
);

app.use(express.json());

// In-memory demo store
const store = {
  users: {
    alice: { balances: { ETH: 100, XAN: 50 } },
    bob: { balances: { ETH: 50, XAN: 100 } },
  },
  txs: [],
  intents: [],
};

// Health check
app.get("/api/health", (req, res) => res.json({ status: "ok", env: process.env.NODE_ENV || "dev" }));

// Routes
app.get("/api/balance", (req, res) => {
  const { user } = req.query;
  if (!user || !store.users[user]) return res.status(400).json({ error: "Unknown user" });
  return res.json({ user, balances: store.users[user].balances });
});

app.get("/api/txs", (req, res) => res.json(store.txs));
app.get("/api/intents", (req, res) => res.json(store.intents));

app.get("/api/faucet", (req, res) => {
  const { user } = req.query;
  if (!user || !store.users[user]) return res.status(400).json({ error: "Unknown user" });
  store.users[user].balances.ETH += 100;
  store.users[user].balances.XAN += 100;
  return res.json({ user, balances: store.users[user].balances });
});

app.post("/api/send", (req, res) => {
  const { from, to, token, amount } = req.body;
  if (!store.users[from] || !store.users[to]) return res.status(400).json({ error: "Invalid user" });
  if (typeof amount !== "number" || amount <= 0) return res.status(400).json({ error: "Invalid amount" });
  if (!store.users[from].balances[token] || store.users[from].balances[token] < amount) {
    return res.status(400).json({ error: "Insufficient balance" });
  }
  store.users[from].balances[token] -= amount;
  store.users[to].balances[token] += amount;
  const tx = { from, to, token, amount, time: new Date().toISOString(), type: "send" };
  store.txs.push(tx);
  return res.json({ tx, senderBalance: store.users[from] });
});

app.post("/api/intent", (req, res) => {
  const { maker, action, amount, from_asset, to_asset } = req.body;
  if (!store.users[maker]) return res.status(400).json({ error: "Invalid user" });
  if (typeof amount !== "number" || amount <= 0) return res.status(400).json({ error: "Invalid amount" });
  if (!store.users[maker].balances[from_asset] || store.users[maker].balances[from_asset] < amount) {
    return res.status(400).json({ error: "Insufficient balance" });
  }
  const intent = { maker, action, amount, from_asset, to_asset, status: "pending", time: new Date().toISOString() };
  store.intents.push(intent);
  return res.json({ intent });
});

// Start server (Railway requires process.env.PORT)
const PORT = process.env.PORT || 4000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
