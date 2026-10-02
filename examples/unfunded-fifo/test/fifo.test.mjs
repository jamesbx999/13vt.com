import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import ganache from 'ganache';
import solc from 'solc';
import { BrowserProvider, ContractFactory, encodeBytes32String } from 'ethers';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = readFileSync(join(root, 'contracts', 'UnfundedFifoModel.sol'), 'utf8');
const input = {
  language: 'Solidity',
  sources: { 'UnfundedFifoModel.sol': { content: source } },
  settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } },
};
const result = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = (result.errors ?? []).filter(item => item.severity === 'error');
assert.deepEqual(errors.map(e => e.formattedMessage), [], 'Solidity compiler errors');
const artifact = result.contracts['UnfundedFifoModel.sol'].UnfundedFifoModel;
assert.ok(artifact.evm.bytecode.object.length > 0);

async function setup() {
  const provider = new BrowserProvider(ganache.provider({ logging: { quiet: true } }));
  const operator = await provider.getSigner(0);
  const other = await provider.getSigner(1);
  const factory = new ContractFactory(artifact.abi, '0x' + artifact.evm.bytecode.object, operator);
  const model = await factory.deploy();
  await model.waitForDeployment();
  return { model, operator, other };
}
const ref = value => encodeBytes32String(value);
const gas = { gasLimit: 500_000 };
const seed = async (model, owner, funding) => {
  const id = await model.nextId();
  await (await model.seedRoot(owner, funding, gas)).wait();
  return id;
};
const addA = async (model, owner, funding = '0x' + '00'.repeat(32)) => {
  const id = await model.nextId();
  await (await model.enqueueQualifiedFromA(owner, funding, gas)).wait();
  return id;
};
const place = async (model, id) => (await model.place(id, gas)).wait();

// PaymentState enum: Unfunded=0, FundedPending=1, Paid=2.
test('U1 must have a successful mock payout AND both children before U2 enters FIFO, with no copied funding', async () => {
  const { model, operator, other } = await setup();
  const u1 = await seed(model, operator.address, ref('U1-deposit-2'));
  const a1 = await addA(model, other.address, ref('A1-deposit-2'));
  const d = await addA(model, other.address); // D #2 is NOT assigned as D's reserve by the latest rule.

  assert.equal(await model.nextOpenParent(), u1);
  assert.equal(await model.paymentState(u1), 1n);
  await assert.rejects(model.recordMockPayout(u1, ref('too-soon')));
  await place(model, a1);
  assert.equal((await model.positions(u1)).leftId, a1);
  assert.equal((await model.positions(u1)).rightId, 0n);
  assert.equal(await model.nextId(), 4n, 'left alone must not create U2');

  await place(model, d);
  assert.equal((await model.positions(u1)).rightId, d);
  assert.equal(await model.nextId(), 4n, 'right alone without payout proof must not create U2');
  assert.equal(await model.nextOpenParent(), a1);
  await (await model.recordMockPayout(u1, ref('U1-deposit-2'), gas)).wait();

  const u2 = 4n;
  assert.equal(await model.queueLength(), 4n);
  assert.equal((await model.positions(u2)).origin, 1n); // RebornB
  assert.equal((await model.positions(u2)).owner, operator.address);
  assert.equal((await model.positions(u2)).queueSequence, 4n);
  assert.equal(await model.paymentState(u1), 2n);
  assert.equal(await model.paymentState(u2), 0n);
  assert.equal((await model.positions(u2)).illustrativeFundingRef, '0x' + '00'.repeat(32));
  assert.equal((await model.positions(d)).illustrativeFundingRef, '0x' + '00'.repeat(32));
  assert.equal(await model.paymentState(d), 0n);
  await assert.rejects(model.recordMockPayout(u1, ref('duplicate')), 'once-only payout marker');
  await assert.rejects(model.connect(other).enqueueQualifiedFromA(other.address, ref('unauthorized')));
});

test('fee policy accepts exactly 0.0013 BNB in wei but the mock collects nothing', async () => {
  const { model } = await setup();
  const exact = 1_300_000_000_000_000n;
  assert.equal(await model.SERVICE_FEE_WEI(), exact);
  assert.equal(await model.serviceFeeIsExact(exact), true);
  assert.equal(await model.serviceFeeIsExact(exact - 1n), false);
  assert.equal(await model.serviceFeeIsExact(exact + 1n), false);
});

test('central even-deposit markers fund the oldest B parent when its left child is placed', async () => {
  const { model, operator, other } = await setup();
  const u1 = await seed(model, operator.address, '0x' + '00'.repeat(32));
  const left = await addA(model, other.address);
  const right = await addA(model, other.address);
  const centralRef = ref('A4-central-pool');

  await (await model.recordMockCentralEvenFunding(centralRef, gas)).wait();
  await place(model, left);
  const afterLeft = await model.positions(u1);
  assert.equal(afterLeft.leftId, left);
  assert.equal(afterLeft.payoutConfirmed, true, 'left placement consumes central funding');
  assert.equal(afterLeft.illustrativeFundingRef, centralRef);
  assert.equal(await model.paymentState(u1), 2n);
  assert.equal(await model.centralEvenFundingHead(), 1n);

  await place(model, right);
  assert.equal(await model.nextId(), 5n, 'U2 is created only after both slots are filled');
  assert.equal((await model.positions(4)).origin, 1n);
  assert.equal(await model.paymentState(4), 0n, 'successor starts UNFUNDED');
});

test('unfunded U2 receives left and right in place-and-hold without being skipped, paid, or reborn again', async () => {
  const { model, operator, other } = await setup();
  await seed(model, operator.address, ref('U1-deposit-2'));
  const a1 = await addA(model, other.address, ref('A1-deposit-2'));
  const d = await addA(model, other.address);
  await place(model, a1);
  await (await model.recordMockPayout(1, ref('U1-deposit-2'), gas)).wait();
  await place(model, d); // Both slots: reborn in the same transaction.
  assert.equal(await model.nextId(), 5n);
  assert.equal(await model.paymentState(4), 0n);

  // A1 and D precede U2 in the same FIFO; fill their slots without payouts.
  for (const parentId of [a1, d]) {
    for (const expectedSide of ['leftId', 'rightId']) {
      const child = await addA(model, other.address);
      await place(model, child);
      assert.equal((await model.positions(parentId))[expectedSide], child);
    }
  }
  assert.equal(await model.nextOpenParent(), 4n, 'U2 is now the oldest open parent');

  const left = await addA(model, other.address);
  await place(model, left);
  assert.equal((await model.positions(4)).leftId, left, 'unfunded parent is not skipped');
  assert.equal(await model.paymentState(4), 0n);
  assert.equal((await model.positions(4)).payoutConfirmed, false);
  assert.equal(await model.nextOpenParent(), 4n, 'right slot is next');
  await assert.rejects(model.recordMockPayout(4, ref('cannot-pay-unfunded')));

  const right = await addA(model, other.address);
  const before = await model.nextId();
  await place(model, right);
  assert.equal((await model.positions(4)).rightId, right);
  assert.equal(await model.nextId(), before, 'no U3 without successful payout proof');
  assert.equal(await model.paymentState(4), 0n);
  await assert.rejects(async () => (await model.place(right)).wait(), 'child cannot be placed twice');
});

test('illustrative funding refs are unique and cannot mark another position paid', async () => {
  const { model, operator, other } = await setup();
  const u1 = await seed(model, operator.address, ref('U1-deposit-2'));
  const a1 = await addA(model, other.address, ref('A1-deposit-2'));
  await assert.rejects(model.enqueueQualifiedFromA(other.address, ref('U1-deposit-2')), 'same illustrative deposit cannot fund two positions');
  const unassigned = await addA(model, other.address);
  await assert.rejects(model.recordMockFunding(unassigned, ref('U1-deposit-2')), 'cannot attach an already-used funding ref');
  await place(model, a1);
  await assert.rejects(model.recordMockPayout(u1, ref('A1-deposit-2')), 'wrong deposit cannot simulate payout for U1');
  assert.equal(await model.paymentState(u1), 1n);
  await (await model.recordMockPayout(u1, ref('U1-deposit-2'), gas)).wait();
  assert.equal(await model.paymentState(u1), 2n);
  assert.equal(await model.paymentState(unassigned), 0n);
});
