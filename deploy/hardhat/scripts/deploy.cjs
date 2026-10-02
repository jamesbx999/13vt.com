const hre = require("hardhat");
const { ethers } = hre;

const ZERO = ethers.ZeroAddress;
const TESTNET_DEFAULTS = {
  asset: "0x337610d27c682e347c9cd60bd4b3b107c9d34ddd",
  feeWallet: "0xE465e694E9194b848D597b21ce4104f9C36Fc6d2",
  owner: "0x11B948575B648be50Eef781251ebdc876907E618",
};

function requiredAddress(name, value) {
  if (!value || value === ZERO) throw new Error(`${name} is required`);
  return ethers.getAddress(value);
}

async function main() {
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== 97n && network.chainId !== 56n) {
    throw new Error(`Refusing deployment on unsupported chain ${network.chainId}`);
  }

  const [deployer] = await ethers.getSigners();
  const asset = requiredAddress("ASSET_ADDRESS", process.env.ASSET_ADDRESS || (network.chainId === 97n ? TESTNET_DEFAULTS.asset : ""));
  const feeWallet = requiredAddress("FEE_WALLET", process.env.FEE_WALLET || TESTNET_DEFAULTS.feeWallet);
  const owner = requiredAddress("INITIAL_OWNER", process.env.INITIAL_OWNER || TESTNET_DEFAULTS.owner);
  if (owner.toLowerCase() !== TESTNET_DEFAULTS.owner.toLowerCase()) {
    throw new Error("INITIAL_OWNER must match the designated owner in the contract");
  }

  const preview = { chainId: network.chainId.toString(), deployer: await deployer.getAddress(), asset, feeWallet, owner };
  if (process.env.EXECUTE_DEPLOY !== "YES") {
    console.log(JSON.stringify(preview, null, 2));
    console.log("DRY RUN: no deployment transaction was sent. Set EXECUTE_DEPLOY=YES only after review.");
    return;
  }

  const implFactory = await ethers.getContractFactory("Transparent13VTQueueUpgradeable");
  const implementation = await implFactory.deploy();
  await implementation.waitForDeployment();
  const implementationAddress = await implementation.getAddress();

  const initData = implFactory.interface.encodeFunctionData("initialize", [asset, feeWallet, owner]);
  const proxyFactory = await ethers.getContractFactory("ERC1967ProxyDeploy");
  const proxy = await proxyFactory.deploy(implementationAddress, initData);
  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();

  const queue = await ethers.getContractAt("Transparent13VTQueueUpgradeable", proxyAddress);
  const [actualOwner, actualAsset, actualFee, amount, fee] = await Promise.all([
    queue.owner(), queue.asset(), queue.feeWallet(), queue.depositAmount(), queue.serviceFeeWei(),
  ]);

  const result = {
    chainId: network.chainId.toString(),
    deployer: await deployer.getAddress(),
    implementation: implementationAddress,
    proxy: proxyAddress,
    owner: actualOwner,
    asset: actualAsset,
    feeWallet: actualFee,
    depositAmount: amount.toString(),
    serviceFeeWei: fee.toString(),
  };
  console.log(JSON.stringify(result, null, 2));

  console.log("Deployment transactions were already submitted by this script.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
