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

  // Operator approval state
  const [isCheckingOperator, setIsCheckingOperator] = useState<boolean>(false);
  const [operatorStatus, setOperatorStatus] = useState<Record<string, boolean>>({});

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
   * Check token allowance for the batcher contract
   */
  const checkTokenAllowance = useCallback(
    async (tokenAddress: string, ownerAddress: string) => {
      if (!ethersReadonlyProvider || !eBatcher?.address) return null;

      try {
        const tokenContract = new ethers.Contract(
          tokenAddress,
          [
            "function allowance(address owner, address spender) external view returns (uint256)",
          ],
          ethersReadonlyProvider,
        );

        const allowance = await tokenContract.allowance(ownerAddress, eBatcher.address);
        console.log("📝 Token allowance:", {
          token: tokenAddress,
          owner: ownerAddress,
          spender: eBatcher.address,
          allowance: allowance.toString(),
        });

        return allowance;
      } catch (e) {
        // Silently fail - token might not implement standard ERC-20 allowance
        // This is expected for some ERC-7984 tokens
        return null;
      }
    },
    [ethersReadonlyProvider, eBatcher?.address],
  );

  /**
   * Check if the batcher contract is set as an operator for the ERC-7984 token
   */
  const checkOperatorStatus = useCallback(
    async (tokenAddress: string, ownerAddress: string): Promise<boolean> => {
      if (!ethersReadonlyProvider || !eBatcher?.address) return false;

      try {
        const tokenContract = new ethers.Contract(
          tokenAddress,
          [
            "function isOperator(address account, address operator) external view returns (bool)",
          ],
          ethersReadonlyProvider,
        );

        const isOperator = await tokenContract.isOperator(ownerAddress, eBatcher.address);
        console.log("📝 Operator status:", {
          token: tokenAddress,
          owner: ownerAddress,
          operator: eBatcher.address,
          isOperator,
        });

        // Cache the result
        setOperatorStatus(prev => ({
          ...prev,
          [`${tokenAddress}-${ownerAddress}`]: isOperator,
        }));

        return isOperator;
      } catch (e) {
        console.error("Failed to check operator status:", e);
        return false;
      }
    },
    [ethersReadonlyProvider, eBatcher?.address],
  );

  /**
   * Set the batcher contract as an operator for the ERC-7984 token
   */
  const setOperator = useCallback(
    async (tokenAddress: string) => {
      if (!ethersSigner || !eBatcher?.address || !accounts || accounts.length === 0) {
        setMessage("Signer or account not available");
        return false;
      }

      setIsCheckingOperator(true);
      setMessage("Setting batcher contract as operator...");

      try {
        const tokenContract = new ethers.Contract(
          tokenAddress,
          [
            "function setOperator(address operator, uint48 until) external returns (bool)",
          ],
          ethersSigner,
        );

        // Set operator with maximum expiration time (permanent)
        const until = 0xFFFFFFFFFFFF; // Max uint48 value
        
        console.log("📝 Setting operator:", {
          token: tokenAddress,
          operator: eBatcher.address,
          until,
        });

        const tx = await tokenContract.setOperator(eBatcher.address, until);
        const explorerUrl = chainId === 11155111 
          ? `https://sepolia.etherscan.io/tx/${tx.hash}` 
          : `https://etherscan.io/tx/${tx.hash}`;
        
        setMessage(`⏳ SetOperator transaction submitted!\nTX: ${tx.hash}\nView: ${explorerUrl}`);
        
        await tx.wait();
        
        setMessage(`✅ Operator set successfully! The batcher contract can now transfer your tokens.`);
        
        // Update cached operator status
        setOperatorStatus(prev => ({
          ...prev,
          [`${tokenAddress}-${accounts[0]}`]: true,
        }));

        return true;
      } catch (e: any) {
        console.error("❌ Failed to set operator:", e);
        
        let errorMessage = "Failed to set operator: ";
        if (e.reason) {
          errorMessage += e.reason;
        } else if (e.error?.message) {
          errorMessage += e.error.message;
        } else if (e.message) {
          errorMessage += e.message;
        } else {
          errorMessage += String(e);
        }
        
        setMessage(errorMessage);
        return false;
      } finally {
        setIsCheckingOperator(false);
      }
    },
    [ethersSigner, eBatcher?.address, accounts, chainId],
  );

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

      // Check operator status for ERC-7984 tokens (REQUIRED)
      if (accounts && accounts.length > 0) {
        setMessage("Checking if batcher contract is set as operator...");
        const isOperator = await checkOperatorStatus(tokenAddress, accounts[0]);
        
        if (!isOperator) {
          setMessage(
            `⚠️ Batcher contract is not set as operator!\n\nThe eBatcher contract needs to be approved as an operator to transfer tokens on your behalf.\n\nThis is a one-time setup. Click "Set Operator" below to approve.`,
          );
          setIsProcessing(false);
          return;
        }
        
        setMessage("✅ Operator status confirmed. Proceeding with batch transfer...");
      }

      // Check token allowance (optional - for backward compatibility with standard ERC-20)
      if (accounts && accounts.length > 0) {
        const allowance = await checkTokenAllowance(tokenAddress, accounts[0]);
        const totalAmount = amount * BigInt(recipients.length);
        if (allowance !== null && allowance < totalAmount) {
          setMessage(
            `⚠️ Insufficient token allowance!\nRequired: ${totalAmount.toString()}\nCurrent allowance: ${allowance.toString()}\n\nPlease approve the eBatcher contract to spend your tokens first.`,
          );
          setIsProcessing(false);
          return;
        }
      }

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

        console.log("📝 batchSendTokenSameAmount parameters:", {
          tokenAddress,
          recipients,
          recipientsCount: recipients.length,
          amount: amount.toString(),
          encryptedHandle: toHex(enc.handles[0]),
          inputProof: toHex(enc.inputProof),
          allParams: params,
        });

        setMessage("Sending transaction...");
        const tx = await writeContract.batchSendTokenSameAmount(...params);
        const explorerUrl = chainId === 11155111 ? `https://sepolia.etherscan.io/tx/${tx.hash}` : `https://etherscan.io/tx/${tx.hash}`;
        setMessage(`⏳ Transaction submitted!\nTX: ${tx.hash}\nWaiting for block confirmation...\nView: ${explorerUrl}`);
        const receipt = await tx.wait(2); // Wait for 2 confirmations
        setMessage(`✅ Confirmed! Sent ${amount.toString()} tokens to ${recipients.length} recipients.\n\nTransaction: ${receipt.hash}\nBlock: ${receipt.blockNumber}\nConfirmations: 2+\nExplorer: ${explorerUrl}`);
      } catch (e: any) {
        console.error("❌ Batch transfer error:", e);

        let errorMessage = "Batch transfer failed: ";

        // Try to extract revert reason
        if (e.reason) {
          errorMessage += e.reason;
        } else if (e.error?.message) {
          errorMessage += e.error.message;
        } else if (e.data?.message) {
          errorMessage += e.data.message;
        } else if (e.message) {
          errorMessage += e.message;
        } else {
          errorMessage += String(e);
        }

        // Log additional error details
        console.error("Error details:", {
          code: e.code,
          reason: e.reason,
          method: e.method,
          transaction: e.transaction,
          data: e.data,
        });

        setMessage(errorMessage);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, canInteract, maxBatchSize, encryptWith, getContract, eBatcher?.abi, accounts, checkTokenAllowance, checkOperatorStatus, chainId],
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

      // Check operator status for ERC-7984 tokens (REQUIRED)
      if (accounts && accounts.length > 0) {
        setMessage("Checking if batcher contract is set as operator...");
        const isOperator = await checkOperatorStatus(tokenAddress, accounts[0]);
        
        if (!isOperator) {
          setMessage(
            `⚠️ Batcher contract is not set as operator!\n\nThe eBatcher contract needs to be approved as an operator to transfer tokens on your behalf.\n\nThis is a one-time setup. Click "Set Operator" below to approve.`,
          );
          setIsProcessing(false);
          return;
        }
        
        setMessage("✅ Operator status confirmed. Proceeding with batch transfer...");
      }

      // Check token allowance (optional - for backward compatibility with standard ERC-20)
      if (accounts && accounts.length > 0) {
        const allowance = await checkTokenAllowance(tokenAddress, accounts[0]);
        const totalAmount = amounts.reduce((sum, amt) => sum + amt, BigInt(0));
        if (allowance !== null && allowance < totalAmount) {
          setMessage(
            `⚠️ Insufficient token allowance!\nRequired: ${totalAmount.toString()}\nCurrent allowance: ${allowance.toString()}\n\nPlease approve the eBatcher contract to spend your tokens first.`,
          );
          setIsProcessing(false);
          return;
        }
      }

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
        const encryptedHandles = enc.handles.map(h => toHex(h));
        const inputProof = toHex(enc.inputProof);

        console.log("📝 batchSendTokenDifferentAmounts parameters:", {
          tokenAddress,
          recipients,
          recipientsCount: recipients.length,
          amounts: amounts.map(a => a.toString()),
          encryptedHandles,
          inputProof,
        });

        setMessage("Sending transaction...");
        const tx = await writeContract.batchSendTokenDifferentAmounts(
          tokenAddress,
          recipients,
          encryptedHandles, // All encrypted handles from single encryption
          inputProof, // Single shared input proof
        );
        const explorerUrl = chainId === 11155111 ? `https://sepolia.etherscan.io/tx/${tx.hash}` : `https://etherscan.io/tx/${tx.hash}`;
        setMessage(`⏳ Transaction submitted!\nTX: ${tx.hash}\nWaiting for block confirmation...\nView: ${explorerUrl}`);
        const receipt = await tx.wait(2); // Wait for 2 confirmations
        setMessage(`✅ Confirmed! Sent different amounts to ${recipients.length} recipients.\n\nTransaction: ${receipt.hash}\nBlock: ${receipt.blockNumber}\nConfirmations: 2+\nExplorer: ${explorerUrl}`);
      } catch (e: any) {
        console.error("❌ Batch transfer error:", e);

        let errorMessage = "Batch transfer failed: ";

        // Try to extract revert reason
        if (e.reason) {
          errorMessage += e.reason;
        } else if (e.error?.message) {
          errorMessage += e.error.message;
        } else if (e.data?.message) {
          errorMessage += e.data.message;
        } else if (e.message) {
          errorMessage += e.message;
        } else {
          errorMessage += String(e);
        }

        // Log additional error details
        console.error("Error details:", {
          code: e.code,
          reason: e.reason,
          method: e.method,
          transaction: e.transaction,
          data: e.data,
        });

        setMessage(errorMessage);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, canInteract, maxBatchSize, encryptWith, getContract, accounts, checkTokenAllowance, checkOperatorStatus, chainId],
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
          ],
          ethersReadonlyProvider,
        );

        // Get encrypted balance handle
        const encryptedBalance = await tokenContract.confidentialBalanceOf(userAddress);
        const handleHex = typeof encryptedBalance === "string" ? encryptedBalance : encryptedBalance.toString();

        console.log("✅ Got encrypted balance handle:", handleHex);

        // Check if balance is zero (0x0000...0000)
        if (handleHex === "0x0000000000000000000000000000000000000000000000000000000000000000") {
          setMessage("Balance is zero (or uninitialized). No need to decrypt.");
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
    // Operator management
    checkOperatorStatus,
    setOperator,
    isCheckingOperator,
    operatorStatus,
    // Wagmi-specific values
    chainId,
    accounts,
    isConnected,
    ethersSigner,
  };
};


