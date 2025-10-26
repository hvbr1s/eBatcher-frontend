# eBatcher7984 Quick Start Guide

## ✅ Contract Already Deployed

**Sepolia Testnet:** `0x6c2C8A3Bd837f8F0c3286885ea17c17392af91df`

You can start using the app immediately - no deployment needed!

---

## 🚀 2-Step Setup (Using Deployed Contract)

### 1️⃣ Install & Generate

```bash
pnpm install
pnpm generate    # Generates TypeScript types from deployed contract
```

### 2️⃣ Start the App
```bash
pnpm start       # Opens http://localhost:3000
```

That's it! The app will connect to the already-deployed contract on Sepolia.

---

## 🎯 How to Use

1. **Open** <http://localhost:3000>
2. **Connect wallet** (switch to Sepolia testnet)
3. **Enter token address** (your ERC-7984 token)
4. **Add recipients** (one address per line)
5. **Enter amount(s)**
6. **Click "Send Batch Transfer"**

---

## 🛠️ Optional: Local Development

If you want to test locally with your own deployment:

```bash
# Terminal 1: Start local FHEVM node
pnpm chain

# Terminal 2: Deploy to localhost
pnpm deploy:localhost
pnpm generate

# Terminal 3: Start frontend
pnpm start
```

---

## 📋 Common Commands

```bash
# Development
pnpm chain                    # Start local node
pnpm deploy:localhost         # Deploy to localhost
pnpm deploy:sepolia          # Deploy to Sepolia
pnpm generate                # Generate TypeScript ABIs
pnpm start                   # Start frontend

# Testing
pnpm hardhat:test            # Run all tests
pnpm hardhat:test --grep "eBatcher"  # Run eBatcher tests only

# Build
pnpm compile                 # Compile contracts
pnpm next:build             # Build frontend
```

---

## 🎯 Quick Example

### Batch Transfer (Same Amount)
```
Token: 0xYourERC7984TokenAddress
Recipients:
  0xRecipient1...
  0xRecipient2...
  0xRecipient3...
Amount: 1000000
```
**Result**: Each recipient gets 1,000,000 tokens (encrypted)

### Batch Transfer (Different Amounts)
```
Token: 0xYourERC7984TokenAddress
Recipients:
  0xRecipient1...
  0xRecipient2...
  0xRecipient3...
Amounts:
  1000000
  2000000
  3000000
```
**Result**: Recipients get different amounts (all encrypted)

---

## ⚠️ Before You Start

1. **Deploy an ERC-7984 Token** or use an existing one
2. **Approve the Batcher Contract**:
   ```javascript
   await token.approve(eBatcherAddress, totalAmount);
   ```
3. **Have Testnet ETH** (for Sepolia) or use Hardhat accounts (localhost)

---

## 🐛 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Import errors | `cd packages/hardhat && npm install` |
| Nonce errors | MetaMask → Settings → Advanced → Clear Activity |
| FHEVM not connected | Wait a few seconds for initialization |
| Transaction fails | Check token approval first |

---

## 📚 More Info

- **Full Setup**: [EBATCHER_SETUP.md](./EBATCHER_SETUP.md)
- **All Changes**: [INTEGRATION_SUMMARY.md](./INTEGRATION_SUMMARY.md)
- **Deployed Contract** (Sepolia): `0x6c2C8A3Bd837f8F0c3286885ea17c17392af91df`

---

## 🎉 That's It!

You're ready to batch transfer confidential tokens with FHE encryption!

