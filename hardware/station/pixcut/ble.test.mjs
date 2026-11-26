// node --test hardware/station/pixcut/ble.test.mjs   (no printer needed)
import assert from 'node:assert/strict';
import test from 'node:test';
import { BLE_CHUNK, PixCutBle, dataFrames, frame, jsonFrame, takeFrames } from './ble.mjs';

const text = (b) => new TextDecoder().decode(b);

test('JSON frame layout and checksum', () => {
  const f = jsonFrame({ method: 'get-prop', params: ['printer-state'], id: 5 });
  const body = '{"method":"get-prop","params":["printer-state"],"id":5}';
  assert.equal(f.length, body.length + 22);
  assert.deepEqual([...f.subarray(0, 6)], [0x7e, 100, 0, 1, 6, 3]);
  const v = new DataView(f.buffer);
  assert.equal(v.getUint32(10, true), 1); // msgSn
  assert.equal(v.getUint16(14, true), 1); // package total
  assert.equal(v.getUint16(16, true), 1); // package number
  assert.equal(v.getUint16(18, true), body.length); // attr = body length, not split
  assert.equal(text(f.subarray(20, 20 + body.length)), body);
  let sum = 0;
  for (const b of f.subarray(1, f.length - 2)) sum = (sum + b) & 0xff;
  assert.equal(f.at(-2), sum);
  assert.equal(f.at(-1), 0x7e);
});

test('job data frames: 182 bytes, job id first, numbered, split flag', () => {
  const payload = new Uint8Array(BLE_CHUNK * 2 + 10).fill(0xaa);
  const frames = dataFrames(payload, 66);
  assert.equal(frames.length, 3);
  assert.equal(frames[0].length, 182);
  assert.equal(frames[2].length, 10 + 4 + 22);
  frames.forEach((f, i) => {
    const v = new DataView(f.buffer);
    assert.deepEqual([f[3], f[4], f[5]], [2, 6, 2]);
    assert.equal(v.getUint32(10, true), i + 1);
    assert.equal(v.getUint16(14, true), 3);
    assert.equal(v.getUint16(16, true), i + 1);
    assert.equal(v.getUint16(18, true) & 0x2000, 0x2000);
    assert.equal(v.getInt32(20, true), 66);
  });
});

test('takeFrames copes with split and back-to-back frames', () => {
  const a = frame(new TextEncoder().encode('{"id":1}'));
  const b = frame(new TextEncoder().encode('{"id":2}'));
  const joined = new Uint8Array([...a, ...b]);
  const [first, rest] = takeFrames(joined.subarray(0, a.length + 7));
  assert.deepEqual(first.map(text), ['{"id":1}']);
  const [second, rest2] = takeFrames(new Uint8Array([...rest, ...joined.subarray(a.length + 7)]));
  assert.deepEqual(second.map(text), ['{"id":2}']);
  assert.equal(rest2.length, 0);
});

/** A pretend printer on the other end of the write characteristic. */
function fakePrinter({ failAt = Infinity, ackEvery = true } = {}) {
  const state = { received: [], polls: 0, jobDeclared: null };
  let printer;
  const reply = (o) => {
    const f = frame(new TextEncoder().encode(JSON.stringify(o)));
    // deliver in two notifications, like a small MTU would
    printer.onData(f.slice(0, 20));
    printer.onData(f.slice(20));
  };
  const write = {
    async writeValueWithoutResponse(bytes) {
      const [[body]] = takeFrames(new Uint8Array(bytes));
      let o = null;
      try { o = JSON.parse(text(body)); } catch { /* job data */ }
      setTimeout(() => {
        if (o?.method === 'get-prop') {
          const busy = state.received.length > 0 && state.polls++ < 2;
          reply({ result: busy ? ['40', '3030', '::0'] : ['20', '2000', '::0'], id: o.id });
        } else if (o?.method === 'combo-job') {
          state.jobDeclared = o.params;
          reply({ result: [{ 'job-id': 66 }], id: o.id });
        } else {
          state.received.push(...body.subarray(4));
          if (state.received.length >= failAt) reply({ method: 'event.rpt_err', params: { code: -8013, message: 'job timeout' } });
          else if (ackEvery) printer.onAck(new Uint8Array([1, 1]));
        }
      }, 0);
    },
  };
  printer = new PixCutBle(write);
  return { printer, state };
}

test('print + cut against a pretend printer: cut path first, every byte delivered', async () => {
  const { printer, state } = fakePrinter();
  const jpeg = new Uint8Array(5000).map((_, i) => i & 0xff);
  const plt = new Uint8Array(700).fill(3);
  const seen = [];
  const res = await printer.printAndCut(jpeg, plt, { onStatus: (s) => seen.push(s.phase) });
  assert.deepEqual(res, { jobId: 66, cut: true });
  assert.deepEqual(state.received, [...plt, ...jpeg]);
  assert.equal(state.jobDeclared[0].params['file-size'], 5000);
  assert.equal(state.jobDeclared[1].params['file-size'], 700);
  assert.ok(seen.includes('upload') && seen.includes('run'));
});

test('a printer error mid-upload stops the job with its message', async () => {
  const { printer } = fakePrinter({ failAt: 1000 });
  await assert.rejects(printer.printAndCut(new Uint8Array(5000), new Uint8Array(700)), /-8013 job timeout/);
});
