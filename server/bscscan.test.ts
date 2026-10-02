import axios from "axios";
import { describe, expect, it } from "vitest";
import { ENV } from "./_core/env";

describe("BscScan API credentials", () => {
  it("can call a lightweight BSC Mainnet endpoint without exposing the key", async () => {
    expect(ENV.bscscanApiKey).toBeTruthy();
    const response = await axios.get("https://api.etherscan.io/v2/api", {
      params: {
        chainid: "56",
        module: "account",
        action: "balance",
        address: "0x11B948575B648be50Eef781251ebdc876907E618",
        tag: "latest",
        apikey: ENV.bscscanApiKey,
      },
      timeout: 30_000,
    });
    expect(response.data?.result).toBeDefined();
    expect(String(response.data?.message || "").toLowerCase()).not.toContain("invalid api key");
  }, 45_000);
});
