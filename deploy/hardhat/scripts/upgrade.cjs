const hre = require("hardhat");
const { ethers } = hre;

const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const DESIGNATED_OWNER = "0x11B948575B648be50Eef781251ebdc876907E618";

function requiredAddress(name, value) {
  if (!value) throw new Error(`${name} is required`);
  return ethers.getAddress(value);
}

async function main() {
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== 97n && network.chainId !== 56n) {
    throw new Error(`Refusing upgrade on unsupported chain ${network.chainId}`);
  }
  const proxyAddress = requiredAddress("PROXY_ADDRESS", process.env.PROXY_ADDRESS);
  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();
  const queue = await ethers.getContractAt("Transparent13VTQueueUpgradeable", proxyAddress);
  const owner = await queue.owner();
  const oldSlot = await ethers.provider.getStorage(proxyAddress, IMPLEMENTATION_SLOT);
  const oldImplementation = ethers.getAddress(`0x${oldSlot.slice(-40)}`);

  const preview = {
    chainId: network.chainId.toString(),
    signer: signerAddress,
    proxy: proxyAddress,
    owner,
    oldImplementation,
  };
  console.log(JSON.stringify(preview, null, 2));

  if (owner.toLowerCase() !== signerAddress.toLowerCase()) {
    throw new Error("Signer is not the current Proxy owner; refusing upgrade");
  }
  if (owner.toLowerCase() !== DESIGNATED_OWNER.toLowerCase()) {
    throw new Error("Proxy owner differs from the designated owner; refusing upgrade");
  }
  const implementationContract = process.env.IMPLEMENTATION_CONTRACT || "Transparent13VTQueueUpgradeableReferral";
  if (process.env.EXECUTE_UPGRADE !== "YES") {
    console.log(JSON.stringify({ implementationContract }, null, 2));
    console.log("DRY RUN: no implementation was deployed and no upgrade call was sent.");
    return;
  }

  const implFactory = await ethers.getContractFactory(implementationContract);
  const implementation = await implFactory.deploy();
  await implementation.waitForDeployment();
  const newImplementation = await implementation.getAddress();
  console.log(JSON.stringify({ newImplementation }, null, 2));

  const tx = await queue.upgradeToAndCall(newImplementation, "0x");
  const receipt = await tx.wait();
  const newSlot = await ethers.provider.getStorage(proxyAddress, IMPLEMENTATION_SLOT);
  const finalImplementation = ethers.getAddress(`0x${newSlot.slice(-40)}`);
  if (finalImplementation.toLowerCase() !== newImplementation.toLowerCase()) {
    throw new Error(`Implementation slot mismatch after upgrade: ${finalImplementation}`);
  }
  console.log(JSON.stringify({ upgradeTx: receipt.hash, proxy: proxyAddress, implementation: finalImplementation }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
