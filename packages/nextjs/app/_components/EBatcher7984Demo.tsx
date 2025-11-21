"use client";

import { useMemo, useState } from "react";
import { useFhevm } from "@fhevm-sdk";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/helper/RainbowKitCustomConnectButton";
import { useEBatcher7984Wagmi } from "~~/hooks/ebatcher-example/useEBatcher7984Wagmi";

/*
 * Main eBatcher7984 React component
 * Allows batch token transfers with encrypted amounts using FHE operations
 */
export const EBatcher7984Demo = () => {
  const { isConnected, chain, address } = useAccount();

  const chainId = chain?.id;

  //////////////////////////////////////////////////////////////////////////////
  // FHEVM instance
  //////////////////////////////////////////////////////////////////////////////

  // Create EIP-1193 provider from wagmi for FHEVM
  // IMPORTANT: For Sepolia, we use RPC URL string instead of window.ethereum
  // to ensure the SDK connects to the correct network for contract reads
  const provider = useMemo(() => {
    if (typeof window === "undefined") return undefined;

    // If on Sepolia, use RPC URL string for proper network connection
    if (chainId === 11155111) {
      return "https://ethereum-sepolia-rpc.publicnode.com";
    }

    // For other networks (like local hardhat), use wallet provider
    return (window as any).ethereum;
  }, [chainId]);

  const initialMockChains = { 31337: "http://localhost:8545" };

  const { instance: fhevmInstance } = useFhevm({
    provider,
    chainId,
    initialMockChains,
    enabled: true,
  });

  //////////////////////////////////////////////////////////////////////////////
  // useEBatcher7984Wagmi hook
  //////////////////////////////////////////////////////////////////////////////

  const eBatcher = useEBatcher7984Wagmi({
    instance: fhevmInstance,
    initialMockChains,
  });

  //////////////////////////////////////////////////////////////////////////////
  // Form state
  //////////////////////////////////////////////////////////////////////////////

  const [tokenAddress, setTokenAddress] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"balance" | "operator" | "batchSame" | "batchDiff">("balance");
  const [recipientsText, setRecipientsText] = useState<string>("");
  const [sameAmount, setSameAmount] = useState<string>("100000000");
  const [differentAmountsText, setDifferentAmountsText] = useState<string>("");
  const [operatorUntil, setOperatorUntil] = useState<string>("281474976710655");

  //////////////////////////////////////////////////////////////////////////////
  // Handlers
  //////////////////////////////////////////////////////////////////////////////

  const handleBatchTransferSame = async () => {
    const recipients = recipientsText
      .split("\n")
      .map(r => r.trim())
      .filter(r => r.length > 0);

    const amount = BigInt(sameAmount || "0");
    await eBatcher.batchSendTokenSameAmount(tokenAddress, recipients, amount);
  };

  const handleBatchTransferDiff = async () => {
    const lines = differentAmountsText
      .split("\n")
      .map(l => l.trim())
      .filter(l => l.length > 0);

    const recipients: string[] = [];
    const amounts: bigint[] = [];

    lines.forEach(line => {
      const [addr, amt] = line.split(",").map(s => s.trim());
      if (addr && amt) {
        recipients.push(addr);
        amounts.push(BigInt(amt));
      }
    });

    await eBatcher.batchSendTokenDifferentAmounts(tokenAddress, recipients, amounts);
  };

  const handleGetBalance = async () => {
    if (!tokenAddress || !address) return;
    await eBatcher.getTokenBalance(tokenAddress, address);
  };

  const handleDecryptBalance = () => {
    eBatcher.decryptBalance();
  };

  const handleSetOperator = async () => {
    if (!tokenAddress) return;
    await eBatcher.setOperator(tokenAddress, operatorUntil);
  };

  if (!isConnected) {
    return (
      <div className="window" style={{ maxWidth: "500px", margin: "0 auto" }}>
        <div className="title-bar">
          <div className="title-bar-text">Connection Required</div>
        </div>
        <div className="window-body text-center">
          <div style={{ margin: "20px 0" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚠️</div>
            <h2 style={{ marginBottom: "12px" }}>Wallet Not Connected</h2>
            <p style={{ marginBottom: "20px" }}>Connect your wallet to use the eBatcher application.</p>
            <RainbowKitCustomConnectButton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="window">
      <div className="title-bar">
        <div className="title-bar-text">eBatcher - Encrypted Batch Transfer</div>
      </div>

      <div className="window-body">
        {/* Wallet Connection */}
        <div className="field-row mb-3">
          <RainbowKitCustomConnectButton />
        </div>

        {/* Configuration Section */}
        <fieldset className="mb-3">
          <legend>Configuration</legend>
          <div className="field-row">
            <label htmlFor="tokenAddress">ERC-7984 Token Address:</label>
            <input
              id="tokenAddress"
              type="text"
              placeholder="0x..."
              value={tokenAddress}
              onChange={e => setTokenAddress(e.target.value)}
              style={{ width: "100%", padding: "5px" }}
            />
          </div>
          <div style={{ fontSize: "10px", color: "#666", marginTop: "4px" }}>
            Enter the address of an ERC-7984 token (encrypted token standard)
          </div>
        </fieldset>

        {/* Tabs */}
        <div className="tabs">
          <button
            className={`tab-button ${activeTab === "balance" ? "active" : ""}`}
            onClick={() => setActiveTab("balance")}
          >
            Check Balance
          </button>
          <button
            className={`tab-button ${activeTab === "operator" ? "active" : ""}`}
            onClick={() => setActiveTab("operator")}
          >
            Set Operator
          </button>
          <button
            className={`tab-button ${activeTab === "batchSame" ? "active" : ""}`}
            onClick={() => setActiveTab("batchSame")}
          >
            Batch (Same Amount)
          </button>
          <button
            className={`tab-button ${activeTab === "batchDiff" ? "active" : ""}`}
            onClick={() => setActiveTab("batchDiff")}
          >
            Batch (Different Amounts)
          </button>
        </div>

        {/* Tab Content: Check Balance */}
        <div className={`tab-content ${activeTab === "balance" ? "active" : ""}`}>
          <fieldset>
            <legend>Check Encrypted Balance</legend>

            {/* Step 1: Get Encrypted Balance Button */}
            {!eBatcher.balanceHandle && (
              <div className="field-row">
                <button
                  className="btn btn-primary"
                  disabled={!eBatcher.canInteract || !tokenAddress || eBatcher.isProcessing}
                  onClick={handleGetBalance}
                >
                  {eBatcher.isProcessing ? "Fetching..." : "Check Balance"}
                </button>
              </div>
            )}

            {/* Step 2: Show Encrypted Handle and Decrypt Button */}
            {eBatcher.balanceHandle && !eBatcher.decryptedBalance && (
              <div>
                <div className="sunken-panel mb-2">
                  <p style={{ fontWeight: "bold", marginBottom: "4px" }}>Encrypted Balance Handle:</p>
                  <p style={{ fontFamily: "Courier New, monospace", fontSize: "10px", wordBreak: "break-all" }}>
                    {eBatcher.balanceHandle}
                  </p>
                </div>
                <div className="field-row">
                  <button
                    className="btn btn-primary"
                    disabled={eBatcher.isDecryptingBalance}
                    onClick={handleDecryptBalance}
                  >
                    {eBatcher.isDecryptingBalance ? "Decrypting..." : "Decrypt Balance"}
                  </button>
                </div>
              </div>
            )}

            {/* Decrypted Balance Display */}
            {eBatcher.decryptedBalance && (
              <div>
                <div className="sunken-panel mb-2" style={{ padding: "6px" }}>
                  <p style={{ fontSize: "10px", margin: 0 }}>
                    <strong>Balance:</strong>{" "}
                    <span style={{ fontFamily: "Courier New, monospace" }}>{eBatcher.decryptedBalance}</span>
                  </p>
                </div>
                <div className="field-row">
                  <button className="btn" onClick={() => setTokenAddress("")}>
                    Check Another Token
                  </button>
                </div>
              </div>
            )}

            {/* Decryption Error */}
            {eBatcher.decryptionError && (
              <div className="info-box error">
                <p style={{ fontFamily: "Courier New, monospace", fontSize: "11px" }}>{eBatcher.decryptionError}</p>
              </div>
            )}

            <div id="balanceResult" className="result-box"></div>
          </fieldset>
        </div>

        {/* Tab Content: Set Operator */}
        <div className={`tab-content ${activeTab === "operator" ? "active" : ""}`}>
          <fieldset>
            <legend>Approve Batcher as Operator</legend>

            <div className="info-box info mb-2">
              <p style={{ fontWeight: "bold", marginBottom: "4px" }}>ℹ️ What is an Operator?</p>
              <p style={{ fontSize: "10px" }}>
                The eBatcher contract needs to be approved as an &quot;operator&quot; to transfer ERC-7984 tokens on
                your behalf. This is a one-time setup per token contract.
              </p>
            </div>

            <div className="field-row">
              <label htmlFor="operatorUntil">Valid Until (timestamp):</label>
              <input
                id="operatorUntil"
                type="text"
                value={operatorUntil}
                onChange={e => setOperatorUntil(e.target.value)}
                style={{ width: "100%", padding: "5px" }}
              />
            </div>
            <div style={{ fontSize: "10px", color: "#666", marginBottom: "8px" }}>
              Default: 281474976710655 (max uint48 - permanent approval)
            </div>

            {/* Operator status display */}
            {tokenAddress && address && eBatcher.operatorStatus[`${tokenAddress}-${address}`] !== undefined && (
              <div
                className={`info-box ${eBatcher.operatorStatus[`${tokenAddress}-${address}`] ? "success" : "warning"} mb-2`}
              >
                <p style={{ fontWeight: "bold" }}>
                  {eBatcher.operatorStatus[`${tokenAddress}-${address}`]
                    ? "✅ Operator Already Set"
                    : "⚠️ Operator Not Set"}
                </p>
                <p style={{ fontSize: "10px", marginTop: "4px" }}>
                  {eBatcher.operatorStatus[`${tokenAddress}-${address}`]
                    ? "The batcher contract is approved. You can proceed with batch transfers."
                    : "You need to set the batcher contract as operator before transferring tokens."}
                </p>
              </div>
            )}

            <div className="field-row">
              <button
                className="btn btn-primary"
                disabled={!eBatcher.canInteract || !tokenAddress || eBatcher.isCheckingOperator}
                onClick={handleSetOperator}
              >
                {eBatcher.isCheckingOperator ? "Setting..." : "Set Operator"}
              </button>
            </div>

            <div id="operatorResult" className="result-box"></div>
          </fieldset>
        </div>

        {/* Tab Content: Batch Same Amount */}
        <div className={`tab-content ${activeTab === "batchSame" ? "active" : ""}`}>
          <fieldset>
            <legend>Batch Transfer (Same Amount)</legend>

            <div className="field-row mb-2">
              <label htmlFor="recipientsSame">Recipients (one address per line):</label>
            </div>
            <textarea
              id="recipientsSame"
              rows={5}
              placeholder={"0x...\n0x...\n0x..."}
              value={recipientsText}
              onChange={e => setRecipientsText(e.target.value)}
              style={{ width: "100%", marginBottom: "8px" }}
            />

            <div className="field-row mb-2">
              <label htmlFor="amountSame">Amount per recipient:</label>
              <input
                id="amountSame"
                type="text"
                value={sameAmount}
                onChange={e => setSameAmount(e.target.value)}
                style={{ flex: 1 }}
              />
            </div>

            <div className="field-row">
              <button
                className="btn btn-primary w-full"
                disabled={!eBatcher.canInteract}
                onClick={handleBatchTransferSame}
              >
                {eBatcher.isProcessing ? "Processing..." : "Send Batch (Same Amount)"}
              </button>
            </div>

            <div id="batchSameResult" className="result-box"></div>
          </fieldset>
        </div>

        {/* Tab Content: Batch Different Amounts */}
        <div className={`tab-content ${activeTab === "batchDiff" ? "active" : ""}`}>
          <fieldset>
            <legend>Batch Transfer (Different Amounts)</legend>

            <div className="field-row mb-2">
              <label htmlFor="recipientsDiff">Recipients & Amounts (address,amount per line):</label>
            </div>
            <textarea
              id="recipientsDiff"
              rows={5}
              placeholder={"0x...,100000000\n0x...,200000000\n0x...,150000000"}
              value={differentAmountsText}
              onChange={e => setDifferentAmountsText(e.target.value)}
              style={{ width: "100%", marginBottom: "8px" }}
            />

            <div className="field-row">
              <button
                className="btn btn-primary w-full"
                disabled={!eBatcher.canInteract}
                onClick={handleBatchTransferDiff}
              >
                {eBatcher.isProcessing ? "Processing..." : "Send Batch (Different Amounts)"}
              </button>
            </div>

            <div id="batchDiffResult" className="result-box"></div>
          </fieldset>
        </div>

        {/* Messages Section */}
        {eBatcher.message && (
          <fieldset className="mt-3">
            <legend>Messages</legend>
            <div className="sunken-panel">
              <div style={{ fontFamily: "Courier New, monospace", fontSize: "11px", whiteSpace: "pre-wrap" }}>
                {eBatcher.message.split("\n").map((line, i) => {
                  // Check if line contains a URL
                  const urlMatch = line.match(/(https?:\/\/[^\s]+)/);
                  if (urlMatch) {
                    const url = urlMatch[1];
                    const parts = line.split(url);
                    return (
                      <div key={i}>
                        {parts[0]}
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "#0000EE", textDecoration: "underline" }}
                        >
                          {url}
                        </a>
                        {parts[1]}
                      </div>
                    );
                  }
                  return <div key={i}>{line}</div>;
                })}
              </div>
            </div>
          </fieldset>
        )}

        {/* Compact Status Section */}
        <fieldset className="mt-3">
          <legend>Status</legend>
          <div style={{ fontSize: "10px", display: "flex", gap: "16px", flexWrap: "wrap" }}>
            <span>
              <strong>Processing:</strong> {eBatcher.isProcessing ? "Yes" : "No"}
            </span>
            <span>
              <strong>Max Batch Size:</strong> {eBatcher.maxBatchSize}
            </span>
            <span>
              <strong>Batcher Contract:</strong>{" "}
              {eBatcher.contractAddress ? `${eBatcher.contractAddress}` : "Not deployed"}
            </span>
          </div>
        </fieldset>

        {/* Status Bar */}
        <div className="status-bar">
          <p className="status-bar-field">Ready</p>
          <p className="status-bar-field">
            {chain?.name || "No network"} | Chain ID: {chainId || "N/A"}
          </p>
        </div>
      </div>
    </div>
  );
};
