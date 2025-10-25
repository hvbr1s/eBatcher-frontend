"use client";

import { useCallback, useMemo } from "react";
import { FhevmInstance } from "../fhevmTypes.js";
import { RelayerEncryptedInput } from "@zama-fhe/relayer-sdk/web";
import { ethers } from "ethers";

export type EncryptResult = {
  handles: Uint8Array[];
  inputProof: Uint8Array;
};

// Map external encrypted integer type to RelayerEncryptedInput builder method
export const getEncryptionMethod = (internalType: string) => {
  switch (internalType) {
    case "externalEbool":
      return "addBool" as const;
    case "externalEuint8":
      return "add8" as const;
    case "externalEuint16":
      return "add16" as const;
    case "externalEuint32":
      return "add32" as const;
    case "externalEuint64":
      return "add64" as const;
    case "externalEuint128":
      return "add128" as const;
    case "externalEuint256":
      return "add256" as const;
    case "externalEaddress":
      return "addAddress" as const;
    default:
      console.warn(`Unknown internalType: ${internalType}, defaulting to add64`);
      return "add64" as const;
  }
};

// Convert Uint8Array or hex-like string to 0x-prefixed hex string
export const toHex = (value: Uint8Array | string): `0x${string}` => {
  if (typeof value === "string") {
    return (value.startsWith("0x") ? value : `0x${value}`) as `0x${string}`;
  }
  // value is Uint8Array
  return ("0x" + Buffer.from(value).toString("hex")) as `0x${string}`;
};

// Build contract params from EncryptResult and ABI for a given function
// Additional non-encrypted parameters can be passed after functionName
export const buildParamsFromAbi = (
  enc: EncryptResult,
  abi: any[],
  functionName: string,
  ...additionalParams: any[]
): any[] => {
  const fn = abi.find((item: any) => item.type === "function" && item.name === functionName);
  if (!fn) throw new Error(`Function ABI not found for ${functionName}`);

  const result: any[] = [];
  let encryptedParamIndex = 0; // Track which encrypted param we're on
  let additionalParamIndex = 0; // Track which additional param we're on

  fn.inputs.forEach((input: any) => {
    // Check if this is an encrypted type (externalEuintX or externalEbool)
    const isEncrypted = input.internalType?.startsWith("external");
    // Check if this is the inputProof parameter (always type "bytes" and name "inputProof")
    const isInputProof = input.type === "bytes" && (input.name === "inputProof" || input.name === "proof");

    if (isEncrypted) {
      // This is an encrypted parameter - use handles
      const raw = enc.handles[encryptedParamIndex];
      encryptedParamIndex++;

      switch (input.type) {
        case "bytes32":
        case "bytes":
          result.push(toHex(raw));
          break;
        case "uint256":
          result.push(BigInt(raw as unknown as string));
          break;
        default:
          console.warn(`Unknown encrypted param type ${input.type}; passing as hex`);
          result.push(toHex(raw));
      }
    } else if (isInputProof) {
      // This is the inputProof parameter - use enc.inputProof
      result.push(toHex(enc.inputProof));
    } else {
      // This is a regular non-encrypted parameter - use additionalParams
      if (additionalParamIndex < additionalParams.length) {
        result.push(additionalParams[additionalParamIndex]);
        additionalParamIndex++;
      } else {
        throw new Error(
          `Missing parameter for ${input.name} (type: ${input.type}) in function ${functionName}. Expected more than ${additionalParams.length} additional params.`
        );
      }
    }
  });

  return result;
};

export const useFHEEncryption = (params: {
  instance: FhevmInstance | undefined;
  ethersSigner: ethers.JsonRpcSigner | undefined;
  contractAddress: `0x${string}` | undefined;
}) => {
  const { instance, ethersSigner, contractAddress } = params;

  const canEncrypt = useMemo(
    () => Boolean(instance && ethersSigner && contractAddress),
    [instance, ethersSigner, contractAddress],
  );

  const encryptWith = useCallback(
    async (buildFn: (builder: RelayerEncryptedInput) => void): Promise<EncryptResult | undefined> => {
      if (!instance || !ethersSigner || !contractAddress) return undefined;

      const userAddress = await ethersSigner.getAddress();
      const input = instance.createEncryptedInput(contractAddress, userAddress) as RelayerEncryptedInput;
      buildFn(input);
      const enc = await input.encrypt();
      return enc;
    },
    [instance, ethersSigner, contractAddress],
  );

  return {
    canEncrypt,
    encryptWith,
  } as const;
};