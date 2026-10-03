const hre = require("hardhat");
const { ethers } = hre;

const OWNER = "0x11B948575B648be50Eef781251ebdc876907E618";
const SERVICE_FEE = ethers.parseEther("0.0013");
const UNIT = ethers.parseUnits("1", 18);
const DEPOSIT = ethers.parseUnits("13", 18);

async function impersonate(address) {
  await hre.network.provider.send("hardhat_setBalance", [address, "0x3635C9ADC5DEA0000000000000000"]);
  await hre.network.provider.send("hardhat_impersonateAccount", [address]);
  return ethers.getSigner(address);
}

async function main() {
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== 31337n) throw new Error("This script is local Hardhat only; no Testnet/Mainnet transaction.");

  const [deployer, recipient, funder, treasury] = await ethers.getSigners();
  const owner = await impersonate(OWNER);

  const mock = await (await ethers.getContractFactory("MockUSDT", deployer)).deploy();
  await mock.waitForDeployment();

  const implementation = await (await ethers.getContractFactory("Transparent13VTQueueUpgradeableReferralV3Accounting", deployer)).deploy();
  await implementation.waitForDeployment();
  const implementationAddress = await implementation.getAddress();
  const initData = implementation.interface.encodeFunctionData("initialize", [await mock.getAddress(), await treasury.getAddress(), OWNER]);
  const proxy = await (await ethers.getContractFactory("ERC1967ProxyDeploy", deployer)).deploy(implementationAddress, initData);
  await proxy.waitForDeployment();
  const queue = await ethers.getContractAt("Transparent13VTQueueUpgradeableReferralV3Accounting", await proxy.getAddress());

  await (await mock.mint(await recipient.getAddress(), DEPOSIT)).wait();
  await (await mock.mint(await funder.getAddress(), DEPOSIT)).wait();

  await (await mock.connect(recipient).approve(await queue.getAddress(), DEPOSIT)).wait();
  const registerReceipt = await (await queue.connect(recipient).registerPosition(await recipient.getAddress(), { value: SERVICE_FEE })).wait();
  const registered = registerReceipt.logs.map(log => { try { return queue.interface.parseLog(log); } catch { return null; } }).find(x => x?.name === "Registered");
  const ticketId = registered.args.ticketId;

  await (await mock.connect(funder).approve(await queue.getAddress(), DEPOSIT)).wait();
  const fundReceipt = await (await queue.connect(funder).fundNext(DEPOSIT, 1)).wait();
  const scheduled = fundReceipt.logs.map(log => { try { return queue.interface.parseLog(log); } catch { return null; } }).find(x => x?.name === "RevenueScheduled");

  await (await queue.connect(owner).initializeAccounting(DEPOSIT)).wait();
  const claimReceipt = await (await queue.connect(recipient).claim(ticketId)).wait();
  const claimed = claimReceipt.logs.map(log => { try { return queue.interface.parseLog(log); } catch { return null; } }).find(x => x?.name === "Claimed");

  const beforeSurplus = await queue.surplus();
  if (beforeSurplus !== DEPOSIT) throw new Error(`Expected surplus 13 mUSDT, got ${beforeSurplus}`);
  const recipientBefore = await mock.balanceOf(await treasury.getAddress());
  const withdrawReceipt = await (await queue.connect(owner).withdrawSurplus(await treasury.getAddress(), DEPOSIT)).wait();
  const recipientAfter = await mock.balanceOf(await treasury.getAddress());
  const afterSurplus = await queue.surplus();

  if (recipientAfter - recipientBefore !== DEPOSIT) throw new Error("Surplus withdrawal amount mismatch");
  if (afterSurplus !== 0n) throw new Error(`Expected zero surplus after withdrawal, got ${afterSurplus}`);
  const ticket = await queue.tickets(ticketId);
  if (!ticket.claimed || ticket.amount !== 0n) throw new Error("Ticket was not claimed correctly");

  console.log(JSON.stringify({
    mode: "local-hardhat-testnet",
    chainId: network.chainId.toString(),
    mockUSDT: await mock.getAddress(),
    implementation: implementationAddress,
    proxy: await queue.getAddress(),
    owner: OWNER,
    recipient: await recipient.getAddress(),
    funder: await funder.getAddress(),
    treasury: await treasury.getAddress(),
    flow: {
      registered: { ticketId: ticketId.toString(), tx: registerReceipt.hash, tokenAmount: DEPOSIT.toString() },
      fundNext: { firstTicketId: scheduled.args.firstTicketId.toString(), lastTicketId: scheduled.args.lastTicketId.toString(), amount: scheduled.args.amount.toString(), tx: fundReceipt.hash },
      claim: { ticketId: claimed.args.ticketId.toString(), amount: claimed.args.amount.toString(), tx: claimReceipt.hash },
      surplusBefore: beforeSurplus.toString(),
      withdrawSurplus: { amount: DEPOSIT.toString(), tx: withdrawReceipt.hash },
      surplusAfter: afterSurplus.toString(),
    },
  }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
