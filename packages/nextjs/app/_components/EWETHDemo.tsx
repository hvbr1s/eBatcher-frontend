"use client";

import { useMemo, useState } from "react";
import { useFhevm } from "@fhevm-sdk";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/helper/RainbowKitCustomConnectButton";
import { useEWETHWagmi } from "~~/hooks/eweth-example/useEWETHWagmi";
import { useDeployedContractInfo } from "~~/hooks/helper";
import type { AllowedChainIds } from "~~/utils/helper/networks";

/*
 * Main eWETH React component
 * Allows wrapping ETH to encrypted WETH and unwrapping with FHE operations
 */
export const EWETHDemo = () => {
  const { isConnected, chain, address } = useAccount();

  const chainId = chain?.id;

  //////////////////////////////////////////////////////////////////////////////
  // FHEVM instance
  //////////////////////////////////////////////////////////////////////////////

  // Create EIP-1193 provider from wagmi for FHEVM
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
  // Get eWETH contract info
  //////////////////////////////////////////////////////////////////////////////

  const allowedChainId = typeof chainId === "number" ? (chainId as AllowedChainIds) : undefined;
  const { data: eWETH } = useDeployedContractInfo({ contractName: "eWETH", chainId: allowedChainId });

  //////////////////////////////////////////////////////////////////////////////
  // useEWETHWagmi hook
  //////////////////////////////////////////////////////////////////////////////

  const eWETHHook = useEWETHWagmi({
    instance: fhevmInstance,
    contractAddress: eWETH?.address || "",
    initialMockChains,
  });

  //////////////////////////////////////////////////////////////////////////////
  // Form state
  //////////////////////////////////////////////////////////////////////////////

  const [activeTab, setActiveTab] = useState<"deposit" | "withdraw" | "balance">("deposit");
  const [depositAmount, setDepositAmount] = useState<string>("0.001");
  const [withdrawAmount, setWithdrawAmount] = useState<string>("0.001");

  //////////////////////////////////////////////////////////////////////////////
  // Handlers
  //////////////////////////////////////////////////////////////////////////////

  const handleDeposit = async () => {
    try {
      const amountWei = BigInt(Math.floor(parseFloat(depositAmount) * 1e18));
      await eWETHHook.deposit(amountWei);
    } catch (error) {
      console.error("Deposit error:", error);
    }
  };

  const handleInitiateWithdrawal = async () => {
    try {
      const amountWei = BigInt(Math.floor(parseFloat(withdrawAmount) * 1e18));
      await eWETHHook.initiateWithdrawal(amountWei);
    } catch (error) {
      console.error("Withdrawal error:", error);
    }
  };

  const handleCompleteWithdrawal = () => {
    eWETHHook.completeWithdrawal();
  };

  const handleGetBalance = async () => {
    await eWETHHook.getBalance();
  };

  const handleDecryptBalance = () => {
    eWETHHook.decryptBalance();
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
            <p style={{ marginBottom: "20px" }}>Connect your wallet to use the eWETH application.</p>
            <RainbowKitCustomConnectButton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="window">
      <div className="title-bar">
        <div className="title-bar-text">eWETH - Encrypted Wrapped ETH</div>
      </div>

      <div className="window-body">
        {/* Wallet Connection */}
        <div className="field-row mb-3">
          <RainbowKitCustomConnectButton />
        </div>

        {/* Tabs */}
        <div className="tabs">
          <button
            className={`tab-button ${activeTab === "deposit" ? "active" : ""}`}
            onClick={() => setActiveTab("deposit")}
          >
            Wrap ETH
          </button>
          <button
            className={`tab-button ${activeTab === "withdraw" ? "active" : ""}`}
            onClick={() => setActiveTab("withdraw")}
          >
            Unwrap ETH
          </button>
          <button
            className={`tab-button ${activeTab === "balance" ? "active" : ""}`}
            onClick={() => setActiveTab("balance")}
          >
            Check eWETH Balance
          </button>
        </div>

        {/* Tab Content: Deposit */}
        <div className={`tab-content ${activeTab === "deposit" ? "active" : ""}`}>
          <fieldset>
            <legend>Deposit ETH to Receive eWETH</legend>

            <div className="info-box info mb-2">
              <p style={{ fontSize: "10px" }}>
                💡 Deposit ETH to receive encrypted wrapped ETH (eWETH). Your balance will be encrypted and private.
              </p>
            </div>

            <div className="field-row mb-2">
              <label htmlFor="depositAmount">Amount (ETH):</label>
              <input
                id="depositAmount"
                type="text"
                value={depositAmount}
                onChange={e => setDepositAmount(e.target.value)}
                placeholder="0.001"
                style={{ flex: 1 }}
              />
            </div>

            <div className="field-row">
              <button
                className="btn btn-primary w-full"
                disabled={!eWETHHook.canInteract || eWETHHook.isProcessing}
                onClick={handleDeposit}
              >
                {eWETHHook.isProcessing ? "Processing..." : "Deposit ETH"}
              </button>
            </div>
          </fieldset>
        </div>

        {/* Tab Content: Withdraw */}
        <div className={`tab-content ${activeTab === "withdraw" ? "active" : ""}`}>
          <fieldset>
            <legend>Withdraw eWETH to ETH (Two-Step Process)</legend>

            <div className="info-box warning mb-2">
              <p style={{ fontWeight: "bold", marginBottom: "4px" }}>⚠️ FHEVM v0.9 Two-Step Withdrawal</p>
              <p style={{ fontSize: "10px" }}>
                1. <strong>Initiate Withdrawal</strong>: Encrypt and submit the withdrawal amount
                <br />
                2. <strong>Complete Withdrawal</strong>: Decrypt the amount and finalize the withdrawal
              </p>
            </div>

            {!eWETHHook.pendingWithdrawalHandle ? (
              <>
                <div className="field-row mb-2">
                  <label htmlFor="withdrawAmount">Amount (ETH):</label>
                  <input
                    id="withdrawAmount"
                    type="text"
                    value={withdrawAmount}
                    onChange={e => setWithdrawAmount(e.target.value)}
                    placeholder="0.001"
                    style={{ flex: 1 }}
                  />
                </div>

                <div className="field-row">
                  <button
                    className="btn btn-primary w-full"
                    disabled={!eWETHHook.canInteract || eWETHHook.isProcessing}
                    onClick={handleInitiateWithdrawal}
                  >
                    {eWETHHook.isProcessing ? "Processing..." : "🔹 Step 1: Initiate Withdrawal"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="sunken-panel mb-2">
                  <p style={{ fontSize: "10px", marginBottom: "4px" }}>
                    <strong>Withdrawal Handle:</strong>
                  </p>
                  <p style={{ fontFamily: "Courier New, monospace", fontSize: "9px", wordBreak: "break-all" }}>
                    {eWETHHook.pendingWithdrawalHandle}
                  </p>
                </div>

                <div className="field-row">
                  <button
                    className="btn btn-primary w-full"
                    disabled={eWETHHook.isProcessing || eWETHHook.isDecrypting}
                    onClick={handleCompleteWithdrawal}
                  >
                    {eWETHHook.isProcessing || eWETHHook.isDecrypting
                      ? "Processing..."
                      : "🔹 Step 2: Decrypt & Complete"}
                  </button>
                </div>
              </>
            )}
          </fieldset>
        </div>

        {/* Tab Content: Balance */}
        <div className={`tab-content ${activeTab === "balance" ? "active" : ""}`}>
          <fieldset>
            <legend>Check Encrypted Balance</legend>

            <div className="info-box info mb-2">
              <p style={{ fontSize: "10px" }}>
                💡 Your eWETH balance is encrypted. First, make it publicly decryptable, then decrypt it to view.
              </p>
            </div>

            {/* Step 1: Get Encrypted Balance Button */}
            {!eWETHHook.balanceHandle && (
              <div className="field-row">
                <button
                  className="btn btn-primary"
                  disabled={!eWETHHook.canInteract || !address || eWETHHook.isProcessing}
                  onClick={handleGetBalance}
                >
                  {eWETHHook.isProcessing ? "Fetching..." : "Get Balance"}
                </button>
              </div>
            )}

            {/* Step 2: Show Encrypted Handle and Decrypt Button */}
            {eWETHHook.balanceHandle && !eWETHHook.decryptedBalance && (
              <div>
                <div className="sunken-panel mb-2">
                  <p style={{ fontWeight: "bold", marginBottom: "4px" }}>Encrypted Balance Handle:</p>
                  <p style={{ fontFamily: "Courier New, monospace", fontSize: "10px", wordBreak: "break-all" }}>
                    {eWETHHook.balanceHandle}
                  </p>
                </div>
                <div className="field-row">
                  <button className="btn btn-primary" disabled={eWETHHook.isDecrypting} onClick={handleDecryptBalance}>
                    {eWETHHook.isDecrypting ? "Decrypting..." : "Decrypt Balance"}
                  </button>
                </div>
              </div>
            )}

            {/* Decrypted Balance Display */}
            {eWETHHook.decryptedBalance && (
              <div>
                <div className="sunken-panel mb-2" style={{ padding: "12px", backgroundColor: "#e8f5e9" }}>
                  <p style={{ fontSize: "12px", fontWeight: "bold", marginBottom: "8px" }}>✅ eWETH Balance:</p>
                  <p style={{ fontSize: "20px", fontFamily: "Courier New, monospace", color: "#2e7d32" }}>
                    {(parseFloat(eWETHHook.decryptedBalance) / 1e18).toFixed(6)} ETH
                  </p>
                  <p style={{ fontSize: "9px", color: "#666", marginTop: "4px" }}>{eWETHHook.decryptedBalance} wei</p>
                </div>
                <div className="field-row">
                  <button
                    className="btn"
                    onClick={() => {
                      eWETHHook.getBalance();
                    }}
                  >
                    Refresh Balance
                  </button>
                </div>
              </div>
            )}
          </fieldset>
        </div>

        {/* Messages Section */}
        {eWETHHook.message && (
          <fieldset className="mt-3">
            <legend>Messages</legend>
            <div className="sunken-panel">
              <div style={{ fontFamily: "Courier New, monospace", fontSize: "11px", whiteSpace: "pre-wrap" }}>
                {eWETHHook.message.split("\n").map((line, i) => {
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

        {/* Status Section */}
        <fieldset className="mt-3">
          <legend>Status</legend>
          <div style={{ fontSize: "10px", display: "flex", gap: "16px", flexWrap: "wrap" }}>
            <span>
              <strong>Processing:</strong> {eWETHHook.isProcessing ? "Yes" : "No"}
            </span>
            <span>
              <strong>Decrypting:</strong> {eWETHHook.isDecrypting ? "Yes" : "No"}
            </span>
            <span>
              <strong>Contract:</strong>{" "}
              {eWETH?.address ? `${eWETH.address.slice(0, 6)}...${eWETH.address.slice(-4)}` : "Not deployed"}
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
