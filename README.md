# eBatcher7984 Quick Start Guide

## 🌐 Live Deployment on Sepolia

**Frontend:** [https://ebatcher-frontend.onrender.com](https://ebatcher-frontend.onrender.com)

**Contract (Sepolia):** [`0x6c2C8A3Bd837f8F0c3286885ea17c17392af91df`](https://sepolia.etherscan.io/address/0x6c2C8A3Bd837f8F0c3286885ea17c17392af91df)

You can start using the app immediately - no deployment needed!

## 🎯 What Does This dApp Do?

This dApp provides two simple but useful utilities for ERC-7984 encrypted tokens:

1. **Read Encrypted Tokens**: Connect your wallet, paste any encrypted ERC-7984 token address, and sign a decryption request with your wallet to view your encrypted balance.

2. **Batch Encrypted Payments**: Send encrypted payments to up to 10 recipients (planning to scale this up eventually) with either:
   - Same amount to all recipients
   - Different amounts to each recipient

   This facilitates efficient encrypted payments without revealing amounts on-chain.

---

## 🚀 Local Build & Run

Since the contract is already deployed and verified on [Sepolia](https://sepolia.etherscan.io/address/0x6c2C8A3Bd837f8F0c3286885ea17c17392af91df), you only need to build the frontend:

```bash
pnpm install     # Install dependencies
pnpm next:build  # Build the frontend
pnpm start       # Start the app (opens http://localhost:3000)
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
2. **Have Testnet ETH** (for Sepolia) or use Hardhat accounts (localhost)

---

## 🎉 That's It!

You're ready to batch transfer confidential tokens with FHE encryption!

