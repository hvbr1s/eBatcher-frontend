# eBatcher7984 Quick Start Guide

## 🌐 Live Deployment on Sepolia Testnet

**Frontend:** [https://ebatcher-frontend.onrender.com](https://ebatcher-frontend.onrender.com)

**Contract (Sepolia - Upgradeable Proxy):** [`0xD49a2F55cDd08F5e248b68C2e0645B2bE6fb8Da9`](https://sepolia.etherscan.io/address/0xD49a2F55cDd08F5e248b68C2e0645B2bE6fb8Da9)

**Implementation:** [`0xCA3CD61d243D5B08f342C304ADD03dF5859eb6f7`](https://sepolia.etherscan.io/address/0xCA3CD61d243D5B08f342C304ADD03dF5859eb6f7)

You can start using the app immediately - no deployment needed!

## 🎯 What Does This dApp Do?

This dApp provides two simple but useful utilities for ERC-7984 encrypted tokens:

1. **Read Encrypted Tokens**: Connect your wallet, paste any encrypted ERC-7984 token address, and sign a decryption request with your wallet to view your encrypted balance.

2. **Batch Encrypted Payments**: Send encrypted payments to up to 20 recipients (planning to scale this up eventually) with either:
   - Same amount to all recipients
   - Different amounts to each recipient

   This facilitates efficient encrypted payments without revealing amounts on-chain.

---

## 🚀 Local Build & Run

Since the contract is already deployed and verified on [Sepolia](https://sepolia.etherscan.io/address/0xD49a2F55cDd08F5e248b68C2e0645B2bE6fb8Da9), you only need to build the frontend:

```bash
pnpm install     # Install dependencies
pnpm next:build  # Build the frontend
pnpm start       # Start the app (opens http://localhost:3000)
```

That's it! The app will connect to the already-deployed contract on Sepolia.

---

## 🎯 How to Use

### First Time Setup (Required Once Per Token)

Before you can batch transfer tokens, you need to approve the eBatcher contract as an operator:

1. **Open** <http://localhost:3000>
2. **Connect wallet** (switch to Sepolia testnet)
3. **Navigate to "Operator Setup"** section
4. **Enter your ERC-7984 token address**
5. **Click "Check Operator Status"** to verify if setup is needed
6. **Click "Set Operator"** if not already set (one-time transaction)

✅ This approval is permanent - you only need to do it once per token contract!

### Batch Transfer

Once operator is set:

1. **Enter token address** (same ERC-7984 token)
2. **Add recipients** (one address per line, max 10)
3. **Choose transfer mode** (same or different amounts)
4. **Enter amount(s)**
5. **Click "Send Batch Transfer"**

The app will automatically verify operator status before each transfer.

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
2. **Have Testnet ETH** (for Sepolia) for:
   - Setting operator approval (one-time, ~50k gas)
   - Batch transfer transactions
3. **Set the eBatcher as operator** (see "First Time Setup" above)

---

## 🔧 Technical Note: Operator Approval

The eBatcher contract uses ERC-7984's operator pattern to transfer tokens on your behalf. When you "Set Operator", you're calling:

```solidity
eTokenContract.setOperator(batcherAddress, 0xFFFFFFFFFFFF)
```

This grants the batcher contract permanent approval to transfer your tokens. The approval:
- Is checked automatically before each batch transfer
- Remains active indefinitely (until = max uint48)
- Is specific to each token contract address
- Only allows the batcher to transfer **your** tokens (not anyone else's)

---

## 🎉 That's It!

You're ready to batch transfer confidential tokens with FHE encryption!

