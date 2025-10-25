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
  const { isConnected, chain } = useAccount();

  const chainId = chain?.id;

  //////////////////////////////////////////////////////////////////////////////
  // FHEVM instance
  //////////////////////////////////////////////////////////////////////////////

  // Create EIP-1193 provider from wagmi for FHEVM
  const provider = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return (window as any).ethereum;
  }, []);

  const initialMockChains = { 31337: "http://localhost:8545" };

  const {
    instance: fhevmInstance,
    status: fhevmStatus,
    error: fhevmError,
  } = useFhevm({
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
  const [transferMode, setTransferMode] = useState<"same" | "different">("same");
  const [recipientsText, setRecipientsText] = useState<string>("");
  const [sameAmount, setSameAmount] = useState<string>("");
  const [differentAmountsText, setDifferentAmountsText] = useState<string>("");

  //////////////////////////////////////////////////////////////////////////////
  // Handlers
  //////////////////////////////////////////////////////////////////////////////

  const handleBatchTransfer = async () => {
    const recipients = recipientsText
      .split("\n")
      .map(r => r.trim())
      .filter(r => r.length > 0);

    if (transferMode === "same") {
      const amount = BigInt(sameAmount || "0");
      await eBatcher.batchSendTokenSameAmount(tokenAddress, recipients, amount);
    } else {
      const amounts = differentAmountsText
        .split("\n")
        .map(a => a.trim())
        .filter(a => a.length > 0)
        .map(a => BigInt(a));
      await eBatcher.batchSendTokenDifferentAmounts(tokenAddress, recipients, amounts);
    }
  };

  //////////////////////////////////////////////////////////////////////////////
  // UI Styling
  //////////////////////////////////////////////////////////////////////////////

  const buttonClass =
    "inline-flex items-center justify-center px-6 py-3 font-semibold shadow-lg " +
    "transition-all duration-200 hover:scale-105 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 " +
    "disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed";

  const primaryButtonClass =
    buttonClass +
    " bg-[#FFD208] text-[#2D2D2D] hover:bg-[#A38025] focus-visible:ring-[#2D2D2D] cursor-pointer";

  const secondaryButtonClass =
    buttonClass + " bg-black text-[#F4F4F4] hover:bg-[#1F1F1F] focus-visible:ring-[#FFD208] cursor-pointer";

  const titleClass = "font-bold text-gray-900 text-xl mb-4 border-b-1 border-gray-700 pb-2";
  const sectionClass = "bg-[#f4f4f4] shadow-lg p-6 mb-6 text-gray-900";
  const inputClass =
    "w-full px-4 py-2 border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-[#FFD208] focus:border-transparent";
  const labelClass = "block text-sm font-medium text-gray-700 mb-2";

  if (!isConnected) {
    return (
      <div className="max-w-6xl mx-auto p-6 text-gray-900">
        <div className="flex items-center justify-center">
          <div className="bg-white bordershadow-xl p-8 text-center">
            <div className="mb-4">
              <span className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-900/30 text-amber-400 text-3xl">
                ⚠️
              </span>
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Wallet not connected</h2>
            <p className="text-gray-700 mb-6">Connect your wallet to use the eBatcher7984 demo.</p>
            <div className="flex items-center justify-center">
              <RainbowKitCustomConnectButton />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6 text-gray-900">
      {/* Header */}
      <div className="text-center mb-8 text-black">
        <h1 className="text-3xl font-bold mb-2">eBatcher7984 Demo</h1>
        <p className="text-gray-600">Batch transfer confidential ERC-7984 tokens using FHE</p>
        <p className="text-sm text-gray-500 mt-2">
          Contract: {eBatcher.contractAddress || "Not deployed"} | Max Batch Size: {eBatcher.maxBatchSize}
        </p>
      </div>

      {/* Batch Transfer Form */}
      <div className={sectionClass}>
        <h3 className={titleClass}>📤 Batch Token Transfer</h3>

        <div className="space-y-4">
          {/* Token Address */}
          <div>
            <label className={labelClass}>ERC-7984 Token Address</label>
            <input
              type="text"
              className={inputClass}
              placeholder="0x..."
              value={tokenAddress}
              onChange={e => setTokenAddress(e.target.value)}
            />
          </div>

          {/* Transfer Mode */}
          <div>
            <label className={labelClass}>Transfer Mode</label>
            <div className="flex gap-4">
              <button
                className={transferMode === "same" ? primaryButtonClass : secondaryButtonClass}
                onClick={() => setTransferMode("same")}
              >
                Same Amount
              </button>
              <button
                className={transferMode === "different" ? primaryButtonClass : secondaryButtonClass}
                onClick={() => setTransferMode("different")}
              >
                Different Amounts
              </button>
            </div>
          </div>

          {/* Recipients */}
          <div>
            <label className={labelClass}>
              Recipients (one address per line, max {eBatcher.maxBatchSize})
            </label>
            <textarea
              className={inputClass}
              rows={5}
              placeholder="0x123...&#10;0x456...&#10;0x789..."
              value={recipientsText}
              onChange={e => setRecipientsText(e.target.value)}
            />
          </div>

          {/* Amount(s) */}
          {transferMode === "same" ? (
            <div>
              <label className={labelClass}>Amount (same for all recipients)</label>
              <input
                type="text"
                className={inputClass}
                placeholder="1000000"
                value={sameAmount}
                onChange={e => setSameAmount(e.target.value)}
              />
            </div>
          ) : (
            <div>
              <label className={labelClass}>
                Amounts (one per line, must match number of recipients)
              </label>
              <textarea
                className={inputClass}
                rows={5}
                placeholder="1000000&#10;2000000&#10;3000000"
                value={differentAmountsText}
                onChange={e => setDifferentAmountsText(e.target.value)}
              />
            </div>
          )}

          {/* Submit Button */}
          <button
            className={primaryButtonClass + " w-full"}
            disabled={!eBatcher.canInteract}
            onClick={handleBatchTransfer}
          >
            {eBatcher.canInteract
              ? "🚀 Send Batch Transfer"
              : eBatcher.isProcessing
                ? "⏳ Processing..."
                : "❌ Cannot transfer"}
          </button>
        </div>
      </div>

      {/* Messages */}
      {eBatcher.message && (
        <div className={sectionClass}>
          <h3 className={titleClass}>💬 Messages</h3>
          <div className="border bg-white border-gray-200 p-4">
            <p className="text-gray-800">{eBatcher.message}</p>
          </div>
        </div>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={sectionClass}>
          <h3 className={titleClass}>🔧 FHEVM Instance</h3>
          <div className="space-y-3">
            {printProperty("Instance Status", fhevmInstance ? "✅ Connected" : "❌ Disconnected")}
            {printProperty("Status", fhevmStatus)}
            {printProperty("Error", fhevmError ?? "No errors")}
          </div>
        </div>

        <div className={sectionClass}>
          <h3 className={titleClass}>📊 Batcher Status</h3>
          <div className="space-y-3">
            {printProperty("Processing", eBatcher.isProcessing)}
            {printProperty("Can Interact", eBatcher.canInteract)}
            {printProperty("Max Batch Size", eBatcher.maxBatchSize)}
            {printProperty("Chain ID", eBatcher.chainId ?? "Unknown")}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className={sectionClass}>
        <h3 className={titleClass}>ℹ️ Instructions</h3>
        <div className="space-y-2 text-sm text-gray-700">
          <p>1. Enter the ERC-7984 token contract address you want to batch transfer</p>
          <p>2. Choose transfer mode: Same Amount (all recipients get the same) or Different Amounts (each gets a specific amount)</p>
          <p>3. Enter recipient addresses (one per line)</p>
          <p>4. Enter amount(s) - these will be encrypted using FHE</p>
          <p>5. Click &quot;Send Batch Transfer&quot; to execute</p>
          <p className="font-semibold mt-4">
            ⚠️ Note: Make sure you have approved the eBatcher7984 contract to spend your tokens before attempting a transfer!
          </p>
        </div>
      </div>
    </div>
  );
};

function printProperty(name: string, value: unknown) {
  let displayValue: string;

  if (typeof value === "boolean") {
    return printBooleanProperty(name, value);
  } else if (typeof value === "string" || typeof value === "number") {
    displayValue = String(value);
  } else if (typeof value === "bigint") {
    displayValue = String(value);
  } else if (value === null) {
    displayValue = "null";
  } else if (value === undefined) {
    displayValue = "undefined";
  } else if (value instanceof Error) {
    displayValue = value.message;
  } else {
    displayValue = JSON.stringify(value);
  }
  return (
    <div className="flex justify-between items-center py-2 px-3 bg-white border border-gray-200 w-full">
      <span className="text-gray-800 font-medium">{name}</span>
      <span className="ml-2 font-mono text-sm font-semibold text-gray-900 bg-gray-100 px-2 py-1 border border-gray-300">
        {displayValue}
      </span>
    </div>
  );
}

function printBooleanProperty(name: string, value: boolean) {
  return (
    <div className="flex justify-between items-center py-2 px-3 bg-white border border-gray-200 w-full">
      <span className="text-gray-700 font-medium">{name}</span>
      <span
        className={`font-mono text-sm font-semibold px-2 py-1 border ${
          value
            ? "text-green-800 bg-green-100 border-green-300"
            : "text-red-800 bg-red-100 border-red-300"
        }`}
      >
        {value ? "✓ true" : "✗ false"}
      </span>
    </div>
  );
}

