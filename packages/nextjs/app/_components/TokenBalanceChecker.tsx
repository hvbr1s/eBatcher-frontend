"use client";

import { useState } from "react";
import { useTokenBalance7984 } from "~~/hooks/ebatcher-example/useTokenBalance7984";
import { FhevmInstance } from "@fhevm-sdk";

interface TokenBalanceCheckerProps {
  instance: FhevmInstance | undefined;
  userAddress: string | undefined;
  initialMockChains?: Readonly<Record<number, string>>;
}

/**
 * TokenBalanceChecker - Component for checking ERC-7984 token balances
 *
 * Features:
 * - Input token address
 * - Fetch encrypted balance
 * - Decrypt and display balance with proper formatting
 */
export const TokenBalanceChecker = ({ instance, userAddress, initialMockChains }: TokenBalanceCheckerProps) => {
  const [tokenAddress, setTokenAddress] = useState<string>("");

  const {
    canInteract,
    message,
    isProcessing,
    getTokenBalance,
    decryptBalance,
    decryptedBalance,
    balanceHandle,
    tokenDecimals,
    tokenSymbol,
    isDecryptingBalance,
    decryptionError,
  } = useTokenBalance7984({ instance, initialMockChains });

  const handleGetBalance = async () => {
    if (!userAddress) {
      alert("Please connect your wallet first");
      return;
    }
    if (!tokenAddress) {
      alert("Please enter a token address");
      return;
    }
    await getTokenBalance(tokenAddress, userAddress);
  };

  const handleDecryptBalance = () => {
    decryptBalance();
  };

  return (
    <div className="card w-full bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">ERC-7984 Token Balance Checker</h2>

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
            value={userAddress || ""}
            disabled
          />
        </div>

        <div className="card-actions justify-end mt-6">
          <button
            className="btn btn-primary"
            onClick={handleGetBalance}
            disabled={!canInteract || !userAddress || !tokenAddress}
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

        {decryptedBalance && (
          <div className="stats shadow mt-4">
            <div className="stat">
              <div className="stat-title">Balance</div>
              <div className="stat-value text-primary">
                {tokenDecimals !== null && tokenDecimals > 0
                  ? (Number(decryptedBalance) / 10 ** tokenDecimals).toFixed(Math.min(tokenDecimals, 6))
                  : decryptedBalance}
              </div>
              {tokenSymbol && <div className="stat-desc">{tokenSymbol}</div>}
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
