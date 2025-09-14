// server.js
const express = require("express");
const cors = require("cors");

const app = express();

// ✅ Allow your frontend on Vercel
app.use(
  cors({
    origin: "https://anoma-intent-wallet.vercel.app", // frontend
    methods: ["GET", "POST"],
    credentials: true,
  })
);

app.use(express.json());

// ---- Mock Store ----
const store = {
  users: {
    alice: { balances: { ETH: 100, XAN: 50 } },
    bob: { balances: { ETH: 50, XAN: 100 } },
  },
  txs: [],
  intents: [],
};

// ---- Routes ----
app.get("/", (req, res) => {
  res.send("✅ Backend is running on Railway");
});

// Get balance
app.get("/api/balance", (req, res) => {
  const { user } = req.query;
  if (!store.users[user]) {
    return res.status(400).json({ error: "Unknown user" });
  }
  res.json({ user, balances: store.users[user].balances });
});

// Get transactions
app.get("/api/txs", (req, res) => {
  res.json(store.txs);
});

// Get intents
app.get("/api/intents", (req, res) => {
  res.json(store.intents);
});

// Faucet
app.get("/api/faucet", (req, res) => {
  const { user } = req.query;
  if (!store.users[user]) {
    return res.status(400).json({ error: "Unknown user" });
  }
  store.users[user].balances.ETH += 100;
  store.users[user].balances.XAN += 100;
  res.json({ user, balances: store.users[user].balances });
});

// Send tokens
app.post("/api/send", (req, res) => {
  const { from, to, token, amount } = req.body;
  if (!store.users[from] || !store.users[to]) {
    return res.status(400).json({ error: "Invalid user" });
  }
  if (store.users[from].balances[token] < amount) {
    return res.status(400).json({ error: "Insufficient balance" });
  }

  store.users[from].balances[token] -= amount;
  store.users[to].balances[token] += amount;

  const tx = { from, to, token, amount, time: new Date().toISOString() };
  store.txs.push(tx);

  res.json({ tx, senderBalance: store.users[from] });
});

// Create intent
app.post("/api/intent", (req, res) => {
  const { maker, action, amount, from_asset, to_asset } = req.body;
  if (!store.users[maker]) {
    return res.status(400).json({ error: "Invalid user" });
  }
  if (store.users[maker].balances[from_asset] < amount) {
    return res.status(400).json({ error: "Insufficient balance" });
  }

  const intent = {
    maker,
    action,
    amount,
    from_asset,
    to_asset,
    status: "pending",
  };
  store.intents.push(intent);

  res.json({ intent });
});

// ---- Start server ----
const PORT = process.env.PORT || 4000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

