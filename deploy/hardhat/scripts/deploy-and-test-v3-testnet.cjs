const hre = require("hardhat");
const { ethers } = hre;

const OWNER = "0x11B948575B648be50Eef781251ebdc876907E618";
const SERVICE_FEE = ethers.parseEther("0.0013");
const DEPOSIT = ethers.parseUnits("13", 18);

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required in deploy/hardhat/.env`);
  return value;
}

function txHash(receipt) {
  return receipt.hash || receipt.transactionHash;
}

async function main() {
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== 97n) {
    throw new Error(`Refusing to run: expected BSC Testnet chainId 97, received ${network.chainId}`);
  }

  const execute = process.env.EXECUTE_DEPLOY === "YES";
  if (!execute) {
    console.log(JSON.stringify({
      chainId: "97",
      owner: OWNER,
      deployer: process.env.DEPLOYER_ADDRESS || "set DEPLOYER_ADDRESS for preview",
      recipient: process.env.RECIPIENT_ADDRESS || "set RECIPIENT_ADDRESS for preview",
      funder: process.env.FUNDER_ADDRESS || "set FUNDER_ADDRESS for preview",
      treasury: process.env.TESTNET_TREASURY || "deployer address at execution time",
      asset: "new MockUSDT (18 decimals; testnet/local token only)",
      flow: "deploy MockUSDT → deploy V3 implementation + ERC1967Proxy → mint → register → fundNext → claim → withdrawSurplus",
      execute: false,
    }, null, 2));
    console.log("DRY RUN: no BSC Testnet transaction was sent. Set EXECUTE_DEPLOY=YES only after reviewing the payload and funding all wallets with BNB Testnet.");
    return;
  }

  const deployer = new ethers.Wallet(required("DEPLOYER_PRIVATE_KEY"), ethers.provider);
  const owner = new ethers.Wallet(required("OWNER_PRIVATE_KEY"), ethers.provider);
  const recipient = new ethers.Wallet(required("RECIPIENT_PRIVATE_KEY"), ethers.provider);
  const funder = new ethers.Wallet(required("FUNDER_PRIVATE_KEY"), ethers.provider);
  const treasury = process.env.TESTNET_TREASURY || await deployer.getAddress();
  if ((await owner.getAddress()).toLowerCase() !== OWNER.toLowerCase()) {
    throw new Error(`OWNER_PRIVATE_KEY must resolve to designated owner ${OWNER}`);
  }

  const plan = {
    chainId: "97",
    deployer: await deployer.getAddress(),
    owner: await owner.getAddress(),
    recipient: await recipient.getAddress(),
    funder: await funder.getAddress(),
    treasury,
    asset: "new MockUSDT (18 decimals; testnet/local token only)",
    flow: "deploy MockUSDT → deploy V3 implementation + ERC1967Proxy → mint → register → fundNext → claim → withdrawSurplus",
    execute: true,
  };
  console.log(JSON.stringify(plan, null, 2));

  const MockUSDT = await ethers.getContractFactory("MockUSDT", deployer);
  const mock = await MockUSDT.deploy();
  await mock.waitForDeployment();
  const mockAddress = await mock.getAddress();

  const Impl = await ethers.getContractFactory("Transparent13VTQueueUpgradeableReferralV3Accounting", deployer);
  const implementation = await Impl.deploy();
  await implementation.waitForDeployment();
  const implementationAddress = await implementation.getAddress();

  const initData = implementation.interface.encodeFunctionData("initialize", [mockAddress, treasury, OWNER]);
  const Proxy = await ethers.getContractFactory("ERC1967ProxyDeploy", deployer);
  const proxy = await Proxy.deploy(implementationAddress, initData);
  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();
  const queue = await ethers.getContractAt("Transparent13VTQueueUpgradeableReferralV3Accounting", proxyAddress);

  const mintRecipient = await (await mock.mint(await recipient.getAddress(), DEPOSIT)).wait();
  const mintFunder = await (await mock.mint(await funder.getAddress(), DEPOSIT)).wait();
  await (await mock.connect(recipient).approve(proxyAddress, DEPOSIT)).wait();
  const registeredReceipt = await (await queue.connect(recipient).registerPosition(await recipient.getAddress(), { value: SERVICE_FEE })).wait();
  await (await mock.connect(funder).approve(proxyAddress, DEPOSIT)).wait();
  const fundedReceipt = await (await queue.connect(funder).fundNext(DEPOSIT, 1)).wait();
  const accountingReceipt = await (await queue.connect(owner).initializeAccounting(DEPOSIT)).wait();
  const claimReceipt = await (await queue.connect(recipient).claim(1)).wait();
  const surplusBefore = await queue.surplus();
  const withdrawReceipt = await (await queue.connect(owner).withdrawSurplus(treasury, surplusBefore)).wait();
  const surplusAfter = await queue.surplus();

  console.log(JSON.stringify({
    ...plan,
    asset: mockAddress,
    implementation: implementationAddress,
    proxy: proxyAddress,
    receipts: {
      mintRecipient: txHash(mintRecipient),
      mintFunder: txHash(mintFunder),
      registered: txHash(registeredReceipt),
      fundNext: txHash(fundedReceipt),
      initializeAccounting: txHash(accountingReceipt),
      claim: txHash(claimReceipt),
      withdrawSurplus: txHash(withdrawReceipt),
    },
    accounting: {
      historicalUserDeposits: (await queue.totalUserDeposits()).toString(),
      totalFundedUnclaimed: (await queue.totalFundedUnclaimed()).toString(),
      surplusBefore: surplusBefore.toString(),
      surplusAfter: surplusAfter.toString(),
    },
    warning: "MockUSDT is not BSC USDT and this deployment is for BSC Testnet testing only.",
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
