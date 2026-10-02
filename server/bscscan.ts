import axios from "axios";
import { ENV } from "./_core/env";

const BSCSCAN_ENDPOINT = "https://api.etherscan.io/v2/api";

export type VerifyImplementationInput = {
  contractAddress: string;
  sourceCode: string;
  contractName: string;
  compilerVersion: string;
  optimizationUsed: "0" | "1";
  runs: number;
  constructorArguments?: string;
  evmVersion?: string;
  licenseType?: string;
};

function requireApiKey() {
  if (!ENV.bscscanApiKey) {
    throw new Error("BSCSCAN_API_KEY is not configured on the server");
  }
  return ENV.bscscanApiKey;
}

function assertBscAddress(address: string) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) throw new Error("Invalid BSC contract address");
}

async function postVerification(params: Record<string, string>) {
  const apiKey = requireApiKey();
  const body = new URLSearchParams({ ...params, chainid: "56", apikey: apiKey });
  const response = await axios.post(BSCSCAN_ENDPOINT, body.toString(), {
    headers: { "content-type": "application/x-www-form-urlencoded" },
    timeout: 30_000,
  });
  const data = response.data as { status?: string; message?: string; result?: string };
  if (!data || typeof data.result !== "string") throw new Error("Unexpected BscScan API response");
  return { status: data.status ?? "0", message: data.message ?? "", result: data.result };
}

export async function verifyImplementation(input: VerifyImplementationInput) {
  assertBscAddress(input.contractAddress);
  return postVerification({
    module: "contract",
    action: "verifysourcecode",
    contractaddress: input.contractAddress,
    sourceCode: input.sourceCode,
    codeformat: "solidity-single-file",
    contractname: input.contractName,
    compilerversion: input.compilerVersion,
    optimizationUsed: input.optimizationUsed,
    runs: String(input.runs),
    constructorArguments: input.constructorArguments ?? "",
    evmversion: input.evmVersion ?? "",
    licenseType: input.licenseType ?? "3",
  });
}

export async function verifyProxy(proxyAddress: string) {
  assertBscAddress(proxyAddress);
  return postVerification({
    module: "contract",
    action: "verifyproxycontract",
    address: proxyAddress,
  });
}
