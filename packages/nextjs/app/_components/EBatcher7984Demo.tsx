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
    "inline-flex items-center justify-center px-6 py-3 font-bold uppercase " +
    "border-2 border-t-white border-l-white border-r-black border-b-black " +
    "active:border-t-black active:border-l-black active:border-r-white active:border-b-white " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008080] " +
    "disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed";

  const primaryButtonClass =
    buttonClass +
    " bg-[#008080] text-white hover:bg-[#006666] cursor-pointer";

  const secondaryButtonClass =
    buttonClass + " bg-[#c0c0c0] text-black hover:bg-[#a0a0a0] cursor-pointer";

  const titleClass = "font-bold text-[#00ffff] text-xl mb-4 pb-2 uppercase tracking-wide";
  const sectionClass = "bg-[#2d2d2d] border-4 border-t-[#505050] border-l-[#505050] border-r-black border-b-black p-6 mb-6 text-[#c0c0c0]";
  const inputClass =
    "w-full px-3 py-2 border-2 border-t-black border-l-black border-r-white border-b-white bg-[#1a1a1a] text-[#00ff00] font-mono focus:ring-2 focus:ring-[#008080]";
  const labelClass = "block text-sm font-bold text-[#c0c0c0] mb-2 uppercase";

  if (!isConnected) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-center">
          <div className={sectionClass + " text-center"}>
            <div className="mb-4">
              <span className="inline-flex items-center justify-center w-14 h-14 bg-[#1a1a1a] text-[#ffff00] text-3xl border-2 border-t-black border-l-black border-r-white border-b-white">
                ⚠️
              </span>
            </div>
            <h2 className="text-2xl font-bold text-[#00ffff] mb-2 uppercase">Wallet Not Connected</h2>
            <p className="text-[#c0c0c0] mb-6">Connect your wallet to use the eBatcher7984 demo.</p>
            <div className="flex items-center justify-center">
              <RainbowKitCustomConnectButton />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2 text-[#00ffff] uppercase tracking-wider">CONFIDENTIAL BATCHER</h1>
        <p className="text-[#c0c0c0]">Batch transfer confidential ERC-7984 tokens using FHE</p>
        <p className="text-sm text-[#808080] mt-2 font-mono">
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
          <div className="border-2 border-t-black border-l-black border-r-white border-b-white bg-[#1a1a1a] p-4">
            <div className="text-[#00ff00] font-mono whitespace-pre-wrap break-all">
              {eBatcher.message.split('\n').map((line, i) => {
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
                        className="text-[#00ffff] underline hover:text-[#ffff00]"
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
        <div className="space-y-2 text-sm text-[#c0c0c0]">
          <p>1. Enter the ERC-7984 token contract address you want to batch transfer</p>
          <p>
            2. Choose transfer mode: Same Amount (all recipients get the same) or Different Amounts (each gets a
            specific amount)
          </p>
          <p>3. Enter recipient addresses (one per line)</p>
          <p>4. Enter amount(s) - these will be encrypted using FHE</p>
          <p>5. Click &quot;Send Batch Transfer&quot; to execute</p>
          <p className="font-bold mt-4 text-[#ffff00]">
            ⚠️ Note: Make sure you have approved the eBatcher7984 contract to spend your tokens before attempting a
            transfer!
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
    <div className="flex justify-between items-center py-2 px-3 bg-[#1a1a1a] border-2 border-t-black border-l-black border-r-white border-b-white w-full">
      <span className="text-[#c0c0c0] font-bold uppercase text-sm">{name}</span>
      <span className="ml-2 font-mono text-sm font-semibold text-[#00ff00] bg-[#000000] px-2 py-1 border-2 border-t-black border-l-black border-r-[#505050] border-b-[#505050]">
        {displayValue}
      </span>
    </div>
  );
}

function printBooleanProperty(name: string, value: boolean) {
  return (
    <div className="flex justify-between items-center py-2 px-3 bg-[#1a1a1a] border-2 border-t-black border-l-black border-r-white border-b-white w-full">
      <span className="text-[#c0c0c0] font-bold uppercase text-sm">{name}</span>
      <span
        className={`font-mono text-sm font-bold px-2 py-1 border-2 ${
          value
            ? "text-[#00ff00] bg-[#000000] border-t-black border-l-black border-r-[#00ff00] border-b-[#00ff00]"
            : "text-[#ff0000] bg-[#000000] border-t-black border-l-black border-r-[#ff0000] border-b-[#ff0000]"
        }`}
      >
        {value ? "✓ TRUE" : "✗ FALSE"}
      </span>
    </div>
  );
}

