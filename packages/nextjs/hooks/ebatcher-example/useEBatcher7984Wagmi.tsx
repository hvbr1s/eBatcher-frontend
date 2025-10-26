"use client";

import { useCallback, useMemo, useState } from "react";
import { useDeployedContractInfo } from "../helper";
import { useWagmiEthers } from "../wagmi/useWagmiEthers";
import { FhevmInstance } from "@fhevm-sdk";
import { buildParamsFromAbi, getEncryptionMethod, toHex, useFHEEncryption, useFHEDecrypt } from "@fhevm-sdk";
import { GenericStringInMemoryStorage } from "@fhevm-sdk";
import { ethers } from "ethers";
import type { Contract } from "~~/utils/helper/contract";
import type { AllowedChainIds } from "~~/utils/helper/networks";
import { useReadContract } from "wagmi";

/**
 * useEBatcher7984Wagmi - Hook for interacting with eBatcher7984 contract
 *
 * What it does:
 * - Reads MAX_BATCH_SIZE from the contract
 * - Encrypts token amounts for batch transfers
 * - Sends batch token transfers (same or different amounts)
 * - Handles token rescue functionality
 *
 * Pass your FHEVM instance and this hook handles the rest.
 */
export const useEBatcher7984Wagmi = (parameters: {
  instance: FhevmInstance | undefined;
  initialMockChains?: Readonly<Record<number, string>>;
}) => {
  const { instance, initialMockChains } = parameters;

  // Wagmi + ethers interop
  const { chainId, accounts, isConnected, ethersReadonlyProvider, ethersSigner } = useWagmiEthers(initialMockChains);

  // Resolve deployed contract info once we know the chain
  const allowedChainId = typeof chainId === "number" ? (chainId as AllowedChainIds) : undefined;
  const { data: eBatcher } = useDeployedContractInfo({ contractName: "eBatcher7984", chainId: allowedChainId });

  // Simple status string for UX messages
  const [message, setMessage] = useState<string>("");

  type EBatcherInfo = Contract<"eBatcher7984"> & { chainId?: number };

  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Balance decryption state
  const [balanceTokenAddress, setBalanceTokenAddress] = useState<string>("");
  const [balanceHandle, setBalanceHandle] = useState<string | null>(null);
  const [decryptedBalance, setDecryptedBalance] = useState<string | null>(null);

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
  const hasContract = Boolean(eBatcher?.address && eBatcher?.abi);
  const hasProvider = Boolean(ethersReadonlyProvider);
  const hasSigner = Boolean(ethersSigner);

  const getContract = (mode: "read" | "write") => {
    if (!hasContract) return undefined;
    const providerOrSigner = mode === "read" ? ethersReadonlyProvider : ethersSigner;
    if (!providerOrSigner) return undefined;
    return new ethers.Contract(eBatcher!.address, (eBatcher as EBatcherInfo).abi as any, providerOrSigner);
  };

  // Read MAX_BATCH_SIZE via wagmi
  const maxBatchSizeResult = useReadContract({
    address: (hasContract ? (eBatcher!.address as unknown as `0x${string}`) : undefined) as `0x${string}` | undefined,
    abi: (hasContract ? ((eBatcher as EBatcherInfo).abi as any) : undefined) as any,
    functionName: "MAX_BATCH_SIZE" as const,
    query: {
      enabled: Boolean(hasContract && hasProvider),
      refetchOnWindowFocus: false,
    },
  });

  const maxBatchSize = useMemo(
    () => (maxBatchSizeResult.data ? Number(maxBatchSizeResult.data) : 10),
    [maxBatchSizeResult.data],
  );

  // Encryption hook
  const { encryptWith } = useFHEEncryption({
    instance,
    ethersSigner: ethersSigner as any,
    contractAddress: eBatcher?.address,
  });

  const canInteract = useMemo(
    () => Boolean(hasContract && instance && hasSigner && !isProcessing),
    [hasContract, instance, hasSigner, isProcessing],
  );

  const getEncryptionMethodForFunction = (functionName: string) => {
    const functionAbi = eBatcher?.abi.find(item => item.type === "function" && item.name === functionName);
    if (!functionAbi)
      return { method: undefined as string | undefined, error: `Function ABI not found for ${functionName}` } as const;
    if (functionAbi.type !== "function")
      return { method: undefined as string | undefined, error: `Not a function: ${functionName}` } as const;
    if (!functionAbi.inputs || functionAbi.inputs.length === 0)
      return { method: undefined as string | undefined, error: `No inputs found for ${functionName}` } as const;

    // For batchSendTokenSameAmount: third parameter is amountPerRecipient
    // For batchSendTokenDifferentAmounts: third parameter is amounts array
    // For tokenRescue: third parameter is amount
    const amountParamIndex = functionName === "batchSendTokenSameAmount" || functionName === "tokenRescue" ? 2 : -1;
    if (amountParamIndex === -1 && functionName === "batchSendTokenDifferentAmounts") {
      // This function uses an array, we'll handle it differently
      return { method: "euint64", error: undefined } as const;
    }

    const amountInput = functionAbi.inputs[amountParamIndex];
    if (!amountInput || !amountInput.internalType)
      return {
        method: undefined as string | undefined,
        error: `Amount parameter not found for ${functionName}`,
      } as const;

    return { method: getEncryptionMethod(amountInput.internalType), error: undefined } as const;
  };

  /**
   * Batch send the same token amount to multiple recipients
   */
  const batchSendTokenSameAmount = useCallback(
    async (tokenAddress: string, recipients: string[], amount: bigint) => {
      if (isProcessing || !canInteract) return;
      if (recipients.length === 0) {
        setMessage("At least one recipient is required");
        return;
      }
      if (recipients.length > maxBatchSize) {
        setMessage(`Maximum batch size is ${maxBatchSize}`);
        return;
      }

      setIsProcessing(true);
      setMessage(`Starting batch transfer to ${recipients.length} recipients...`);

      try {
        const { method, error } = getEncryptionMethodForFunction("batchSendTokenSameAmount");
        if (!method) {
          setMessage(error ?? "Encryption method not found");
          return;
        }

        setMessage(`Encrypting amount with ${method}...`);
        const enc = await encryptWith(builder => {
          (builder as any)[method](amount);
        });
        if (!enc) {
          setMessage("Encryption failed");
          return;
        }

        const writeContract = getContract("write");
        if (!writeContract) {
          setMessage("Contract info or signer not available");
          return;
        }

        const params = buildParamsFromAbi(
          enc,
          [...eBatcher!.abi] as any[],
          "batchSendTokenSameAmount",
          tokenAddress,
          recipients,
        );

        setMessage("Sending transaction...");
        const tx = await writeContract.batchSendTokenSameAmount(...params);
        const explorerUrl = chainId === 11155111 ? `https://sepolia.etherscan.io/tx/${tx.hash}` : `https://etherscan.io/tx/${tx.hash}`;
        setMessage(`⏳ Transaction submitted!\nTX: ${tx.hash}\nWaiting for block confirmation...\nView: ${explorerUrl}`);
        const receipt = await tx.wait(2); // Wait for 2 confirmations
        setMessage(`✅ Confirmed! Sent ${amount.toString()} tokens to ${recipients.length} recipients.\n\nTransaction: ${receipt.hash}\nBlock: ${receipt.blockNumber}\nConfirmations: 2+\nExplorer: ${explorerUrl}`);
      } catch (e) {
        setMessage(`Batch transfer failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, canInteract, maxBatchSize, encryptWith, getContract, eBatcher?.abi],
  );

  /**
   * Batch send different token amounts to multiple recipients
   */
  const batchSendTokenDifferentAmounts = useCallback(
    async (tokenAddress: string, recipients: string[], amounts: bigint[]) => {
      if (isProcessing || !canInteract) return;
      if (recipients.length === 0 || amounts.length === 0) {
        setMessage("At least one recipient and amount is required");
        return;
      }
      if (recipients.length !== amounts.length) {
        setMessage("Recipients and amounts arrays must have the same length");
        return;
      }
      if (recipients.length > maxBatchSize) {
        setMessage(`Maximum batch size is ${maxBatchSize}`);
        return;
      }

      setIsProcessing(true);
      setMessage(`Starting batch transfer to ${recipients.length} recipients with different amounts...`);

      try {
        setMessage("Encrypting amounts...");

        // Encrypt all amounts in a single session to get one shared inputProof
        const enc = await encryptWith(builder => {
          for (let i = 0; i < amounts.length; i++) {
            builder.add64(amounts[i]);
          }
        });

        if (!enc) {
          setMessage("Encryption failed");
          return;
        }

        const writeContract = getContract("write");
        if (!writeContract) {
          setMessage("Contract info or signer not available");
          return;
        }

        // Build the final parameters manually since we have an array
        setMessage("Sending transaction...");
        const tx = await writeContract.batchSendTokenDifferentAmounts(
          tokenAddress,
          recipients,
          enc.handles.map(h => toHex(h)), // All encrypted handles from single encryption
          toHex(enc.inputProof), // Single shared input proof
        );
        const explorerUrl = chainId === 11155111 ? `https://sepolia.etherscan.io/tx/${tx.hash}` : `https://etherscan.io/tx/${tx.hash}`;
        setMessage(`⏳ Transaction submitted!\nTX: ${tx.hash}\nWaiting for block confirmation...\nView: ${explorerUrl}`);
        const receipt = await tx.wait(2); // Wait for 2 confirmations
        setMessage(`✅ Confirmed! Sent different amounts to ${recipients.length} recipients.\n\nTransaction: ${receipt.hash}\nBlock: ${receipt.blockNumber}\nConfirmations: 2+\nExplorer: ${explorerUrl}`);
      } catch (e) {
        setMessage(`Batch transfer failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, canInteract, maxBatchSize, encryptWith, getContract],
  );

  /**
   * Get encrypted token balance and automatically trigger decryption
   */
  const getTokenBalance = useCallback(
    async (tokenAddress: string, userAddress: string) => {
      if (isProcessing || !canInteract) return;

      setIsProcessing(true);
      setMessage("Fetching encrypted balance...");
      setBalanceTokenAddress(tokenAddress);
      setBalanceHandle(null);
      setDecryptedBalance(null);

      try {
        const tokenContract = new ethers.Contract(
          tokenAddress,
          [
            "function confidentialBalanceOf(address account) external view returns (bytes32)",
          ],
          ethersReadonlyProvider,
        );

        // Get encrypted balance handle
        const encryptedBalance = await tokenContract.confidentialBalanceOf(userAddress);
        const handleHex = typeof encryptedBalance === "string" ? encryptedBalance : encryptedBalance.toString();

        setMessage("Got encrypted balance handle, starting decryption...");
        setBalanceHandle(handleHex);

        // Wait a moment for React state to update, then auto-trigger decryption
        setTimeout(() => {
          if (fheDecrypt.canDecrypt) {
            fheDecrypt.decrypt();
          }
        }, 100);
      } catch (e) {
        setMessage(`Failed to get balance: ${e instanceof Error ? e.message : String(e)}`);
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
    if (!fheDecrypt.canDecrypt) {
      setMessage("Cannot decrypt: missing handle or FHEVM instance");
      return;
    }

    setMessage("Starting decryption...");
    fheDecrypt.decrypt();
  }, [fheDecrypt]);

  // Update decrypted balance when decryption completes
  useMemo(() => {
    if (fheDecrypt.results && balanceHandle && fheDecrypt.results[balanceHandle]) {
      const balance = fheDecrypt.results[balanceHandle];
      setDecryptedBalance(balance.toString());
      setMessage(`✅ Decrypted Balance: ${balance.toString()}`);
    }
  }, [fheDecrypt.results, balanceHandle]);

  /**
   * Rescue tokens sent to the contract (owner only)
   */
  const tokenRescue = useCallback(
    async (tokenAddress: string, recipient: string, amount: bigint) => {
      if (isProcessing || !canInteract) return;

      setIsProcessing(true);
      setMessage("Starting token rescue...");

      try {
        const { method, error } = getEncryptionMethodForFunction("tokenRescue");
        if (!method) {
          setMessage(error ?? "Encryption method not found");
          return;
        }

        setMessage(`Encrypting amount with ${method}...`);
        const enc = await encryptWith(builder => {
          (builder as any)[method](amount);
        });
        if (!enc) {
          setMessage("Encryption failed");
          return;
        }

        const writeContract = getContract("write");
        if (!writeContract) {
          setMessage("Contract info or signer not available");
          return;
        }

        const params = buildParamsFromAbi(enc, [...eBatcher!.abi] as any[], "tokenRescue", tokenAddress, recipient);

        setMessage("Sending transaction...");
        const tx = await writeContract.tokenRescue(...params);
        const explorerUrl = chainId === 11155111 ? `https://sepolia.etherscan.io/tx/${tx.hash}` : `https://etherscan.io/tx/${tx.hash}`;
        setMessage(`⏳ Transaction submitted!\nTX: ${tx.hash}\nWaiting for block confirmation...\nView: ${explorerUrl}`);
        const receipt = await tx.wait(2); // Wait for 2 confirmations
        setMessage(`✅ Confirmed! Rescued ${amount.toString()} tokens to ${recipient}.\n\nTransaction: ${receipt.hash}\nBlock: ${receipt.blockNumber}\nConfirmations: 2+\nExplorer: ${explorerUrl}`);
      } catch (e) {
        setMessage(`Token rescue failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, canInteract, encryptWith, getContract, eBatcher?.abi],
  );

  return {
    contractAddress: eBatcher?.address,
    maxBatchSize,
    canInteract,
    batchSendTokenSameAmount,
    batchSendTokenDifferentAmounts,
    tokenRescue,
    message,
    isProcessing,
    // Balance decryption
    getTokenBalance,
    decryptBalance,
    decryptedBalance,
    balanceHandle,
    isDecryptingBalance: fheDecrypt.isDecrypting,
    decryptionError: fheDecrypt.error,
    // Wagmi-specific values
    chainId,
    accounts,
    isConnected,
    ethersSigner,
  };
};

