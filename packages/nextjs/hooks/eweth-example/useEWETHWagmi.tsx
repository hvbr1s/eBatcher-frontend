"use client";

import { useCallback, useMemo, useState } from "react";
import { useWagmiEthers } from "../wagmi/useWagmiEthers";
import { FhevmInstance } from "@fhevm-sdk";
import { useFHEEncryption } from "@fhevm-sdk";
import { ethers } from "ethers";
import { useAccount } from "wagmi";

const EWETH_ABI = [
  "function deposit() external payable",
  "function withdraw(bytes32 amount, bytes calldata inputProof) external",
  "function completeWithdrawal(bytes32 handle, bytes calldata cleartexts, bytes calldata decryptionProof) external",
  "function confidentialBalanceOf(address account) external view returns (uint256)",
  "function withdrawalRequests(bytes32 handle) external view returns (address user, bool isPending)",
  "function makeBalancePubliclyDecryptable() external returns (uint256)",
  "function makeBalancePubliclyDecryptableFor(address account) external returns (uint256)",
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
  "event Deposit(address indexed dest, uint256 amount)",
  "event Withdrawal(address indexed source, uint64 amount)",
  "event WithdrawalRequested(address indexed source, bytes32 indexed handle)",
];

/**
 * useEWETHWagmi - Hook for interacting with eWETH contract
 *
 * Handles:
 * - Depositing ETH to receive encrypted wrapped ETH (eWETH)
 * - Withdrawing eWETH back to ETH (two-step process with FHE decryption)
 * - Checking encrypted balances
 */
export const useEWETHWagmi = (parameters: {
  instance: FhevmInstance | undefined;
  contractAddress: string;
  initialMockChains?: Readonly<Record<number, string>>;
}) => {
  const { instance, contractAddress, initialMockChains } = parameters;
  const { address } = useAccount();

  // Wagmi + ethers interop
  const { chainId, ethersReadonlyProvider, ethersSigner } = useWagmiEthers(initialMockChains);

  // UI state
  const [message, setMessage] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isDecrypting, setIsDecrypting] = useState<boolean>(false);

  // Balance state
  const [balanceHandle, setBalanceHandle] = useState<string | null>(null);
  const [decryptedBalance, setDecryptedBalance] = useState<string | null>(null);

  // Withdrawal state
  const [pendingWithdrawalHandle, setPendingWithdrawalHandle] = useState<string | null>(null);

  // Note: We use PUBLIC decryption for both balance and withdrawal
  // because the contract calls makeBalancePubliclyDecryptable() and
  // the withdrawal handle is meant to be publicly decrypted

  // Encryption hook
  const { encryptWith } = useFHEEncryption({
    instance,
    ethersSigner: ethersSigner as any,
    contractAddress: contractAddress as `0x${string}`,
  });

  const hasSigner = Boolean(ethersSigner);
  const hasContract = Boolean(contractAddress && ethers.isAddress(contractAddress));

  const getContract = (mode: "read" | "write") => {
    if (!hasContract) return undefined;
    const providerOrSigner = mode === "read" ? ethersReadonlyProvider : ethersSigner;
    if (!providerOrSigner) return undefined;
    return new ethers.Contract(contractAddress, EWETH_ABI, providerOrSigner);
  };

  const canInteract = useMemo(
    () => Boolean(hasContract && instance && hasSigner && !isProcessing),
    [hasContract, instance, hasSigner, isProcessing],
  );

  /**
   * Deposit ETH to receive eWETH
   */
  const deposit = useCallback(
    async (amountWei: bigint) => {
      if (!canInteract) {
        setMessage("❌ Cannot interact with contract");
        return;
      }

      const contract = getContract("write");
      if (!contract) {
        setMessage("❌ Contract not available");
        return;
      }

      setIsProcessing(true);
      setMessage("💰 Depositing ETH...");

      try {
        // Check if amount exceeds uint64.max
        const uint64Max = BigInt("18446744073709551615");
        if (amountWei > uint64Max) {
          throw new Error(`Amount exceeds uint64 max (${ethers.formatEther(uint64Max.toString())} ETH)`);
        }

        const tx = await contract.deposit!({ value: amountWei });
        setMessage(`🔗 Transaction sent: ${tx.hash}\nWaiting for confirmation...`);

        const receipt = await tx.wait();
        setMessage(`✅ Deposited ${ethers.formatEther(amountWei)} ETH!\nBlock: ${receipt.blockNumber}`);

        // Reset balance to force refresh
        setBalanceHandle(null);
        setDecryptedBalance(null);
      } catch (error: any) {
        console.error("Deposit error:", error);
        setMessage(`❌ Deposit failed: ${error.message || error}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [canInteract],
  );

  /**
   * Initiate withdrawal (step 1 of 2)
   */
  const initiateWithdrawal = useCallback(
    async (amountWei: bigint) => {
      if (!canInteract) {
        setMessage("❌ Cannot interact with contract");
        return;
      }

      const contract = getContract("write");
      if (!contract) {
        setMessage("❌ Contract not available");
        return;
      }

      setIsProcessing(true);
      setMessage("💸 Initiating withdrawal...");

      try {
        // Check if amount exceeds uint64.max
        const uint64Max = BigInt("18446744073709551615");
        if (amountWei > uint64Max) {
          throw new Error(`Amount exceeds uint64 max (${ethers.formatEther(uint64Max.toString())} ETH)`);
        }

        // Encrypt the withdrawal amount
        setMessage("🔐 Encrypting withdrawal amount...");
        const encryptedAmount = await encryptWith(builder => {
          builder.add64(amountWei);
        });

        if (!encryptedAmount) {
          throw new Error("Failed to encrypt amount");
        }

        setMessage("📤 Sending withdrawal request...");
        const tx = await contract.withdraw!(encryptedAmount.handles[0], encryptedAmount.inputProof);
        setMessage(`🔗 Transaction sent: ${tx.hash}\nWaiting for confirmation...`);

        const receipt = await tx.wait();

        // Parse WithdrawalRequested event to get the handle
        const withdrawalRequestedEvent = receipt.logs.find((log: any) => {
          try {
            const parsed = contract.interface.parseLog(log);
            return parsed?.name === "WithdrawalRequested";
          } catch {
            return false;
          }
        });

        if (!withdrawalRequestedEvent) {
          throw new Error("WithdrawalRequested event not found");
        }

        const parsed = contract.interface.parseLog(withdrawalRequestedEvent);
        const handle = parsed!.args.handle;

        setPendingWithdrawalHandle(handle);
        setMessage(
          `✅ Withdrawal initiated!\nBlock: ${receipt.blockNumber}\nHandle: ${handle}\n\nNow decrypt and complete the withdrawal.`,
        );
      } catch (error: any) {
        console.error("Withdrawal error:", error);
        setMessage(`❌ Withdrawal failed: ${error.message || error}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [canInteract, encryptWith],
  );

  /**
   * Complete withdrawal (step 2 of 2) - Uses PUBLIC decryption
   */
  const completeWithdrawal = useCallback(async () => {
    if (!pendingWithdrawalHandle) {
      setMessage("❌ No pending withdrawal");
      return;
    }

    if (!instance) {
      setMessage("❌ Cannot decrypt: FHEVM instance not available");
      return;
    }

    const contract = getContract("write");
    if (!contract) {
      setMessage("❌ Contract not available");
      return;
    }

    setIsProcessing(true);
    setIsDecrypting(true);
    setMessage("🔓 Performing public decryption...");

    try {
      // Use public decryption (the contract called makeBalancePubliclyDecryptable)
      const decryptionResult = await instance.publicDecrypt([pendingWithdrawalHandle]);

      console.log("🔓 Public decryption result:", decryptionResult);

      // Get the cleartext value for this handle
      const cleartextValue = decryptionResult.clearValues[pendingWithdrawalHandle as `0x${string}`];
      if (!cleartextValue) {
        throw new Error(`No cleartext value found for handle ${pendingWithdrawalHandle}`);
      }

      console.log("🔓 Decrypted amount:", cleartextValue.toString(), "wei");
      setMessage(
        `✅ Amount decrypted: ${ethers.formatEther(cleartextValue.toString())} ETH\n🔹 Completing withdrawal with proof verification...`,
      );

      // Complete the withdrawal with the decrypted value and proof
      const completeTx = await contract.completeWithdrawal!(
        pendingWithdrawalHandle,
        decryptionResult.abiEncodedClearValues,
        decryptionResult.decryptionProof,
      );

      setMessage(`🔗 Transaction sent: ${completeTx.hash}\nWaiting for confirmation...`);

      const completeReceipt = await completeTx.wait();

      setMessage(`✅ Withdrawal complete!\nETH transferred to your wallet.\nBlock: ${completeReceipt.blockNumber}`);

      // Reset state
      setPendingWithdrawalHandle(null);
      setBalanceHandle(null);
      setDecryptedBalance(null);
    } catch (error: any) {
      console.error("Complete withdrawal error:", error);
      setMessage(`❌ Failed to complete withdrawal: ${error.message || error}`);
    } finally {
      setIsProcessing(false);
      setIsDecrypting(false);
    }
  }, [pendingWithdrawalHandle, instance]);

  /**
   * Get encrypted balance and make it publicly decryptable
   */
  const getBalance = useCallback(async () => {
    if (!canInteract || !address) {
      setMessage("❌ Cannot interact with contract");
      return;
    }

    const contract = getContract("write");
    if (!contract) {
      setMessage("❌ Contract not available");
      return;
    }

    setIsProcessing(true);
    setMessage("🔐 Getting encrypted balance...");

    try {
      // Make balance publicly decryptable
      const makeTx = await contract.makeBalancePubliclyDecryptable!();
      setMessage(`🔗 Transaction sent: ${makeTx.hash}\nWaiting for confirmation...`);

      const receipt = await makeTx.wait();
      setMessage(`✅ Balance marked as decryptable\nBlock: ${receipt.blockNumber}\n\nFetching encrypted handle...`);

      // Get encrypted balance handle
      const encryptedBalance = await contract.confidentialBalanceOf!(address);
      const balanceHandleHex = ethers.toBeHex(encryptedBalance, 32);

      setBalanceHandle(balanceHandleHex);
      setDecryptedBalance(null);
      setMessage(`📦 Balance handle obtained: ${balanceHandleHex}\n\nClick "Decrypt Balance" to view.`);
    } catch (error: any) {
      console.error("Get balance error:", error);
      setMessage(`❌ Failed to get balance: ${error.message || error}`);
    } finally {
      setIsProcessing(false);
    }
  }, [canInteract, address]);

  /**
   * Decrypt the balance - Uses PUBLIC decryption
   */
  const decryptBalance = useCallback(async () => {
    if (!balanceHandle) {
      setMessage("❌ No balance handle available");
      return;
    }

    if (!instance) {
      setMessage("❌ Cannot decrypt: FHEVM instance not available");
      return;
    }

    setIsDecrypting(true);
    setMessage("🔓 Performing public decryption...");

    try {
      // Use public decryption (the contract called makeBalancePubliclyDecryptable)
      const decryptionResult = await instance.publicDecrypt([balanceHandle]);

      console.log("🔓 Public decryption result:", decryptionResult);

      // Get the cleartext value for this handle
      const balanceValue = decryptionResult.clearValues[balanceHandle as `0x${string}`];
      if (balanceValue === undefined) {
        console.log("⚠️  Balance is zero or uninitialized");
        setDecryptedBalance("0");
        setMessage("✅ Decrypted eWETH balance:\n0 ETH");
        return;
      }

      console.log("🔓 Decrypted balance:", balanceValue.toString(), "wei");
      setDecryptedBalance(balanceValue.toString());
      setMessage(`✅ Decrypted eWETH balance:\n${ethers.formatEther(balanceValue.toString())} ETH`);
    } catch (error: any) {
      console.error("Decrypt balance error:", error);
      setMessage(`❌ Failed to decrypt balance: ${error.message || error}`);
    } finally {
      setIsDecrypting(false);
    }
  }, [balanceHandle, instance]);


  return {
    // State
    message,
    isProcessing,
    isDecrypting,
    canInteract,
    chainId,
    contractAddress,
    balanceHandle,
    decryptedBalance,
    pendingWithdrawalHandle,

    // Actions
    deposit,
    initiateWithdrawal,
    completeWithdrawal,
    getBalance,
    decryptBalance,

    // Helpers
    clearMessage: () => setMessage(""),
  };
};
