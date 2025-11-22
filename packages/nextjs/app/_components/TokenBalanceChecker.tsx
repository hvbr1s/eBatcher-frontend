"use client";

import { useMemo, useState } from "react";
import { useFhevm } from "@fhevm-sdk";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/helper/RainbowKitCustomConnectButton";
import { useTokenBalance7984 } from "~~/hooks/ebatcher-example/useTokenBalance7984";

/**
 * TokenBalanceChecker - Component for checking ERC-7984 token balances
 *
 * Features:
 * - Input token address
 * - Fetch encrypted balance
 * - Decrypt and display balance with proper formatting
 */
export const TokenBalanceChecker = () => {
  const [tokenAddress, setTokenAddress] = useState<string>("");

  const { address, chain } = useAccount();
  const chainId = chain?.id;

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

  const {
    canInteract,
    message,
    isProcessing,
    getTokenBalance,
    decryptBalance,
    balanceHandle,
    isDecryptingBalance,
    decryptionError,
  } = useTokenBalance7984({ instance: fhevmInstance, initialMockChains });

  const handleGetBalance = async () => {
    if (!address) {
      alert("Please connect your wallet first");
      return;
    }
    if (!tokenAddress) {
      alert("Please enter a token address");
      return;
    }
    await getTokenBalance(tokenAddress, address);
  };

  const handleDecryptBalance = () => {
    decryptBalance();
  };

  return (
    <div className="window">
      <div className="title-bar">
        <div className="title-bar-text">ERC-7984 Token Balance Checker</div>
        <div className="title-bar-controls">
          <RainbowKitCustomConnectButton />
        </div>
      </div>

      <div className="window-body" style={{ padding: "12px" }}>
        <div className="form-control w-full">
          <label className="label">
            <span className="label-text">Token Address</span>
          </label>
          <input
            type="text"
            placeholder="0x..."
            className="input input-bordered w-full"
            value={tokenAddress}
            onChange={e => setTokenAddress(e.target.value)}
            disabled={isProcessing}
          />
        </div>

        <div className="form-control w-full mt-4">
          <label className="label">
            <span className="label-text">Your Address</span>
          </label>
          <input
            type="text"
            placeholder="Connect wallet"
            className="input input-bordered w-full"
            value={address || ""}
            disabled
          />
        </div>

        <div className="card-actions justify-end mt-6">
          <button
            className="btn btn-primary"
            onClick={handleGetBalance}
            disabled={!canInteract || !address || !tokenAddress}
          >
            {isProcessing && !isDecryptingBalance ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Fetching...
              </>
            ) : (
              "Get Balance"
            )}
          </button>

          {balanceHandle && balanceHandle !== "0x0000000000000000000000000000000000000000000000000000000000000000" && (
            <button
              className="btn btn-secondary"
              onClick={handleDecryptBalance}
              disabled={!canInteract || isDecryptingBalance}
            >
              {isDecryptingBalance ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Decrypting...
                </>
              ) : (
                "Decrypt Balance"
              )}
            </button>
          )}
        </div>

        {message && (
          <div className="alert mt-4">
            <div className="flex-1">
              <pre className="whitespace-pre-wrap text-sm">{message}</pre>
            </div>
          </div>
        )}

        {decryptionError && (
          <div className="alert alert-error mt-4">
            <div className="flex-1">
              <span>Decryption Error: {decryptionError}</span>
            </div>
          </div>
        )}

        <div className="divider"></div>

        <div className="text-sm opacity-70">
          <p>
            <strong>How it works:</strong>
          </p>
          <ol className="list-decimal list-inside space-y-1 mt-2">
            <li>Enter the ERC-7984 token contract address</li>
            <li>Click &quot;Get Balance&quot; to fetch your encrypted balance</li>
            <li>Click &quot;Decrypt Balance&quot; to reveal the actual amount</li>
          </ol>
        </div>
      </div>
    </div>
  );
};
