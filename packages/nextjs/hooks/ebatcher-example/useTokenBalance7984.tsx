"use client";

import { useCallback, useMemo, useState } from "react";
import { useWagmiEthers } from "../wagmi/useWagmiEthers";
import { FhevmInstance } from "@fhevm-sdk";
import { useFHEDecrypt } from "@fhevm-sdk";
import { GenericStringInMemoryStorage } from "@fhevm-sdk";
import { ethers } from "ethers";

/**
 * useTokenBalance7984 - Hook for checking ERC-7984 token balances
 *
 * What it does:
 * - Fetches encrypted balance from ERC-7984 tokens
 * - Decrypts the balance using FHEVM
 * - Formats balance with proper decimals and symbol
 *
 * Pass your FHEVM instance and this hook handles the rest.
 */
export const useTokenBalance7984 = (parameters: {
  instance: FhevmInstance | undefined;
  initialMockChains?: Readonly<Record<number, string>>;
}) => {
  const { instance, initialMockChains } = parameters;

  // Wagmi + ethers interop
  const { chainId, ethersReadonlyProvider, ethersSigner } = useWagmiEthers(initialMockChains);

  // Simple status string for UX messages
  const [message, setMessage] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Balance decryption state
  const [balanceTokenAddress, setBalanceTokenAddress] = useState<string>("");
  const [balanceHandle, setBalanceHandle] = useState<string | null>(null);
  const [decryptedBalance, setDecryptedBalance] = useState<string | null>(null);
  const [tokenDecimals, setTokenDecimals] = useState<number | null>(null);
  const [tokenSymbol, setTokenSymbol] = useState<string | null>(null);

  // Storage for decryption signatures
  const decryptionStorage = useMemo(() => new GenericStringInMemoryStorage(), []);

  // Setup FHE decryption
  const decryptRequests = useMemo(() => {
    if (!balanceHandle || !balanceTokenAddress) return undefined;
    return [{ handle: balanceHandle, contractAddress: balanceTokenAddress as `0x${string}` }];
  }, [balanceHandle, balanceTokenAddress]);

  const fheDecrypt = useFHEDecrypt({
    instance,
    ethersSigner: ethersSigner as any,
    fhevmDecryptionSignatureStorage: decryptionStorage,
    chainId,
    requests: decryptRequests,
  });

  // -------------
  // Helpers
  // -------------
  const hasProvider = Boolean(ethersReadonlyProvider);
  const hasSigner = Boolean(ethersSigner);

  const canInteract = useMemo(
    () => Boolean(instance && hasSigner && !isProcessing),
    [instance, hasSigner, isProcessing],
  );

  /**
   * Get encrypted token balance
   */
  const getTokenBalance = useCallback(
    async (tokenAddress: string, userAddress: string) => {
      if (isProcessing || !canInteract) return;

      setIsProcessing(true);
      setMessage("Fetching encrypted balance...");
      setBalanceTokenAddress(tokenAddress);
      setBalanceHandle(null);
      setDecryptedBalance(null);
      setTokenDecimals(null);
      setTokenSymbol(null);

      try {
        // Validate token address
        if (!ethers.isAddress(tokenAddress)) {
          setMessage("Invalid token address format");
          return;
        }

        if (!ethersReadonlyProvider) {
          setMessage("Provider not available");
          return;
        }

        console.log("📝 Getting balance for:", {
          tokenAddress,
          userAddress,
        });

        // Check if contract exists
        const code = await ethersReadonlyProvider.getCode(tokenAddress);
        if (code === "0x") {
          setMessage("No contract found at this address. Make sure it's a valid ERC-7984 token contract.");
          return;
        }

        const tokenContract = new ethers.Contract(
          tokenAddress,
          [
            "function confidentialBalanceOf(address account) external view returns (bytes32)",
            "function decimals() external view returns (uint8)",
            "function symbol() external view returns (string)",
          ],
          ethersReadonlyProvider,
        );

        // Fetch token metadata (decimals and symbol) in parallel with balance
        const [encryptedBalance, decimals, symbol] = await Promise.all([
          tokenContract.confidentialBalanceOf(userAddress),
          tokenContract.decimals().catch(() => 18), // Default to 18 if not available
          tokenContract.symbol().catch(() => "TOKEN"), // Default to "TOKEN" if not available
        ]);

        const handleHex = typeof encryptedBalance === "string" ? encryptedBalance : encryptedBalance.toString();

        // Store token metadata
        setTokenDecimals(Number(decimals));
        setTokenSymbol(symbol);

        console.log("✅ Got encrypted balance handle:", handleHex);
        console.log("📝 Token metadata:", { decimals: Number(decimals), symbol });

        // Check if balance is zero (0x0000...0000)
        if (handleHex === "0x0000000000000000000000000000000000000000000000000000000000000000") {
          const symbolDisplay = symbol ? ` ${symbol}` : "";
          setMessage(`✅ Balance: 0${symbolDisplay}\n\nThis balance is zero or uninitialized.`);
          setBalanceHandle(handleHex);
          setDecryptedBalance("0");
          return;
        }

        setMessage("Got encrypted balance handle. Click 'Decrypt Balance' to reveal the amount.");
        setBalanceHandle(handleHex);
      } catch (e: any) {
        console.error("❌ Failed to get balance:", e);

        let errorMessage = "Failed to get balance: ";

        if (e.reason) {
          errorMessage += e.reason;
        } else if (e.error?.message) {
          errorMessage += e.error.message;
        } else if (e.message) {
          errorMessage += e.message;
        } else {
          errorMessage += String(e);
        }

        console.error("Error details:", {
          code: e.code,
          reason: e.reason,
          data: e.data,
        });

        setMessage(errorMessage);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, canInteract, ethersReadonlyProvider, fheDecrypt],
  );

  /**
   * Decrypt the balance after getting the handle
   */
  const decryptBalance = useCallback(() => {
    // Check if balance is already known to be zero
    if (balanceHandle === "0x0000000000000000000000000000000000000000000000000000000000000000") {
      setMessage("Balance is zero (0). No decryption needed.");
      setDecryptedBalance("0");
      return;
    }

    if (!fheDecrypt.canDecrypt) {
      setMessage("Cannot decrypt: missing handle or FHEVM instance");
      return;
    }

    setMessage("Starting decryption...");
    fheDecrypt.decrypt();
  }, [fheDecrypt, balanceHandle]);

  // Update decrypted balance when decryption completes
  useMemo(() => {
    if (fheDecrypt.results && balanceHandle && fheDecrypt.results[balanceHandle]) {
      const balance = fheDecrypt.results[balanceHandle];
      setDecryptedBalance(balance.toString());

      // Format the balance with decimals if available
      let formattedBalance = balance.toString();
      if (tokenDecimals !== null && tokenDecimals > 0) {
        const balanceBigInt = BigInt(balance);
        const divisor = BigInt(10 ** tokenDecimals);
        const integerPart = balanceBigInt / divisor;
        const fractionalPart = balanceBigInt % divisor;

        // Format with proper decimal places
        const fractionalString = fractionalPart.toString().padStart(tokenDecimals, "0");
        // Remove trailing zeros
        const trimmedFractional = fractionalString.replace(/0+$/, "");

        if (trimmedFractional.length > 0) {
          formattedBalance = `${integerPart}.${trimmedFractional}`;
        } else {
          formattedBalance = integerPart.toString();
        }
      }

      const symbol = tokenSymbol || "";
      const displayMessage = symbol
        ? `✅ Decrypted Balance: ${formattedBalance} ${symbol}`
        : `✅ Decrypted Balance: ${formattedBalance}`;

      setMessage(displayMessage);
    }
  }, [fheDecrypt.results, balanceHandle, tokenDecimals, tokenSymbol]);

  return {
    canInteract,
    message,
    isProcessing,
    // Balance methods
    getTokenBalance,
    decryptBalance,
    // Balance state
    decryptedBalance,
    balanceHandle,
    tokenDecimals,
    tokenSymbol,
    isDecryptingBalance: fheDecrypt.isDecrypting,
    decryptionError: fheDecrypt.error,
    // Chain info
    chainId,
  };
};
