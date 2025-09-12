// server.js
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// -------------------------
// Store (in-memory database)
// -------------------------
const store = {
  users: {
    alice: { balances: { ETH: 100, XAN: 50 } },
    bob: { balances: { ETH: 50, XAN: 100 } },
  },
  txs: [], // transactions history
  intents: [], // open intents
};

// -------------------------
// Routes
// -------------------------

// Home: get balances
app.get("/api/home/:user", (req, res) => {
  const user = req.params.user;
  if (!store.users[user]) {
    return res.status(404).json({ error: "User not found" });
  }
  res.json(store.users[user].balances);
});

// Send tokens
app.post("/api/send", (req, res) => {
  const { from, to, token, amount } = req.body;

  if (!store.users[from] || !store.users[to]) {
    return res.status(400).json({ error: "Invalid users" });
  }

  if (store.users[from].balances[token] < amount) {
    return res.status(400).json({ error: "Insufficient balance" });
  }

  // Execute transfer
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

  res.json({ success: true, tx });
});

// Create intent
app.post("/api/intent", (req, res) => {
  const { maker, from_asset, to_asset, amount } = req.body;

  if (!store.users[maker]) {
    return res.status(400).json({ error: "Invalid user" });
  }
  if (store.users[maker].balances[from_asset] < amount) {
    return res.status(400).json({ error: "Insufficient balance" });
  }

  const intent = {
    id: store.intents.length + 1,
    maker,
    from_asset,
    to_asset,
    amount,
    status: "pending",
    created: new Date().toISOString(),
  };
  store.intents.push(intent);

  res.json({ success: true, intent });
});

// Get intents
app.get("/api/intents", (req, res) => {
  res.json(store.intents);
});

// Get transaction history
app.get("/api/history", (req, res) => {
  res.json(store.txs);
});

// -------------------------
// Matcher (runs every 5s)
// -------------------------
function runMatcher() {
  setInterval(() => {
    if (store.intents.length < 2) return; // need at least 2 intents

    for (let i = 0; i < store.intents.length; i++) {
      for (let j = i + 1; j < store.intents.length; j++) {
        const a = store.intents[i];
        const b = store.intents[j];

        if (a.status !== "pending" || b.status !== "pending") continue;

        // Opposite swap? (e.g. ETH->XAN vs XAN->ETH)
        if (a.from_asset === b.to_asset && a.to_asset === b.from_asset) {
          const amount = Math.min(a.amount, b.amount);

          if (
            store.users[a.maker].balances[a.from_asset] >= amount &&
            store.users[b.maker].balances[b.from_asset] >= amount
          ) {
            // Execute swap
            store.users[a.maker].balances[a.from_asset] -= amount;
            store.users[a.maker].balances[a.to_asset] += amount;

            store.users[b.maker].balances[b.from_asset] -= amount;
            store.users[b.maker].balances[b.to_asset] += amount;

            const tx = {
              from: a.maker,
              to: b.maker,
              token: a.from_asset,
              amount,
              time: new Date().toISOString(),
              type: "swap",
            };
            store.txs.push(tx);

            // Update intents
            a.amount -= amount;
            b.amount -= amount;
            if (a.amount === 0) a.status = "fulfilled";
            if (b.amount === 0) b.status = "fulfilled";

            console.log("Matched swap:", tx);
          }
        }
      }
    }
  }, 5000); // run every 5s
}

// -------------------------
// Start server
// -------------------------
app.listen(4000, () => {
  console.log("🚀 Server running at http://localhost:4000");
  runMatcher(); // start matcher
});
