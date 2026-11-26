// Liene PixCut S1 over Bluetooth LE, for browsers with Web Bluetooth (Chrome, Edge, Bluefy on iOS).
//
// Same JSON commands as USB (protocol.mjs), but wrapped in the printer's "Hannto" frames on GATT
// service 0xFF00: write to 0xFF02, replies arrive on notify 0xFF01, and 0xFF03 notifies `01 01`
// after each write it has taken (used to pace the upload). Protocol facts from the notes in
// github.com/eastbaymakersclub/pixcut-s1 and github.com/sincethestudy/liene-pixcut-s1-api;
// this implementation is our own.
//
// Frame: 7E | ver=100 | 0 | connectType | interactive | encoding | terminalId u32 | msgSn u32 |
//        pkgTotal u16 | pkgNum u16 | attr u16 (bits 0-9 body length, bit 13 "split") | body |
//        checksum (sum of every byte after the first 7E, mod 256) | 7E      (all little-endian)
import { PRINTER_STATE, SUB_STATE, ALERTS, MAX_JPEG_BYTES, MEDIA_4X7, alertCodes, describeAlerts } from './protocol.mjs';

const uuid = (short) => `0000${short}-0000-1000-8000-00805f9b34fb`;
export const BLE = { service: uuid('ff00'), data: uuid('ff01'), write: uuid('ff02'), ack: uuid('ff03') };
// 156 job bytes + 4 (job id) + 22 (frame) = 182, the largest write the printer was seen to take.
export const BLE_CHUNK = 156;

const enc = new TextEncoder();
const dec = new TextDecoder();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const supported = () => typeof navigator !== 'undefined' && !!navigator.bluetooth;

export function frame(body, { connectType = 1, interactive = 6, encoding = 3, msgSn = 1, total = 1, num = 1, split = false } = {}) {
  if (body.length > 0x3ff) throw new Error(`frame body too large (${body.length})`);
  const f = new Uint8Array(body.length + 22);
  const v = new DataView(f.buffer);
  f[0] = 0x7e; f[1] = 100; f[2] = 0; f[3] = connectType; f[4] = interactive; f[5] = encoding;
  v.setUint32(6, 0, true);
  v.setUint32(10, msgSn >>> 0, true);
  v.setUint16(14, total & 0xffff, true);
  v.setUint16(16, num & 0xffff, true);
  v.setUint16(18, (split ? 0x2000 : 0) | body.length, true);
  f.set(body, 20);
  let sum = 0;
  for (let i = 1; i < f.length - 2; i++) sum = (sum + f[i]) & 0xff;
  f[f.length - 2] = sum;
  f[f.length - 1] = 0x7e;
  return f;
}

export const jsonFrame = (obj) => frame(enc.encode(JSON.stringify(obj)));

/** Job bytes -> frames, each body prefixed with the little-endian job id. */
export function dataFrames(payload, jobId, chunk = BLE_CHUNK) {
  const total = Math.max(1, Math.ceil(payload.length / chunk));
  const out = [];
  for (let i = 0; i < total; i++) {
    const part = payload.subarray(i * chunk, (i + 1) * chunk);
    const body = new Uint8Array(part.length + 4);
    new DataView(body.buffer).setInt32(0, jobId, true);
    body.set(part, 4);
    out.push(frame(body, { connectType: 2, interactive: 6, encoding: 2, msgSn: i + 1, total, num: i + 1, split: true }));
  }
  return out;
}

/** Pull complete frames out of a byte buffer. Returns [bodies, rest]. */
export function takeFrames(buf) {
  const bodies = [];
  for (;;) {
    const start = buf.indexOf(0x7e);
    if (start < 0) return [bodies, new Uint8Array()];
    if (start > 0) buf = buf.subarray(start);
    if (buf.length < 22) return [bodies, buf];
    if (buf[1] !== 100 && buf[1] !== 1) { buf = buf.subarray(1); continue; }
    const len = (new DataView(buf.buffer, buf.byteOffset, buf.byteLength).getUint16(18, true) & 0x3ff) + 22;
    if (buf.length < len) return [bodies, buf];
    if (buf[len - 1] !== 0x7e) { buf = buf.subarray(1); continue; }
    bodies.push(buf.slice(20, len - 2));
    buf = buf.subarray(len);
  }
}

/** Ask the user to pick the printer (must be called from a tap). */
export function requestPrinter() {
  return navigator.bluetooth.requestDevice({
    filters: [{ namePrefix: 'Liene' }, { namePrefix: 'PixCut' }],
    optionalServices: [BLE.service],
  });
}

export async function openPrinter(device, log = () => {}) {
  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(BLE.service);
  const [write, data, ack] = await Promise.all([BLE.write, BLE.data, BLE.ack].map((u) => service.getCharacteristic(u)));
  const printer = new PixCutBle(write, log);
  const bytesOf = (e) => new Uint8Array(e.target.value.buffer.slice(e.target.value.byteOffset, e.target.value.byteOffset + e.target.value.byteLength));
  data.addEventListener('characteristicvaluechanged', (e) => printer.onData(bytesOf(e)));
  ack.addEventListener('characteristicvaluechanged', (e) => printer.onAck(bytesOf(e)));
  await data.startNotifications();
  await ack.startNotifications();
  device.addEventListener('gattserverdisconnected', () => printer.fail(new Error('Bluetooth connection lost')));
  const close = async () => { try { server.disconnect(); } catch { /* already gone */ } };
  return { printer, close, device };
}

export class PixCutBle {
  constructor(write, log = () => {}) {
    this.write = write;
    this.log = log;
    this.nextId = (Date.now() & 0x7fff) + 1000;
    this.buf = new Uint8Array();
    this.waiting = new Map(); // request id -> { res, rej, timer }
    this.ackWaiter = null;
    this.error = null;
    this.busy = Promise.resolve();
  }

  fail(err) {
    this.error = err;
    for (const w of this.waiting.values()) { clearTimeout(w.timer); w.rej(err); }
    this.waiting.clear();
    if (this.ackWaiter) { clearTimeout(this.ackWaiter.timer); this.ackWaiter.rej(err); }
    this.ackWaiter = null;
  }

  onAck(bytes) {
    if (bytes.length === 2 && bytes[0] === 1 && bytes[1] === 1 && this.ackWaiter) {
      const w = this.ackWaiter;
      this.ackWaiter = null;
      clearTimeout(w.timer);
      w.res();
    }
  }

  onData(bytes) {
    const joined = new Uint8Array(this.buf.length + bytes.length);
    joined.set(this.buf);
    joined.set(bytes, this.buf.length);
    const [bodies, rest] = takeFrames(joined);
    this.buf = rest.length > 8192 ? new Uint8Array() : rest;
    for (const b of bodies) {
      let o;
      try { o = JSON.parse(dec.decode(b).replace(/[\0\r]/g, '').trim()); } catch { continue; }
      if (o?.method === 'event.rpt_err') {
        const p = o.params ?? {};
        this.fail(new Error(`printer error ${p.code ?? ''} ${p.message ?? ''}`.trim()));
        continue;
      }
      const w = this.waiting.get(o?.id);
      if (w) { this.waiting.delete(o.id); clearTimeout(w.timer); w.res(o); }
      else this.log('event', o);
    }
  }

  async send(bytes, wantAck = false, ackMs = 3000) {
    if (this.error) throw this.error;
    let acked;
    if (wantAck) {
      acked = new Promise((res, rej) => {
        const timer = setTimeout(() => { this.ackWaiter = null; rej(new Error('printer stopped acknowledging the upload')); }, ackMs);
        this.ackWaiter = { res, rej, timer };
      });
      acked.catch(() => {});
    }
    if (this.write.writeValueWithoutResponse) await this.write.writeValueWithoutResponse(bytes);
    else await this.write.writeValue(bytes);
    if (acked) await acked;
  }

  // One request at a time, matched by id.
  request(method, params, timeoutMs = 5000) {
    const run = async () => {
      const id = this.nextId++;
      const reply = new Promise((res, rej) => {
        const timer = setTimeout(() => { this.waiting.delete(id); rej(new Error(`no reply to ${method}`)); }, timeoutMs);
        this.waiting.set(id, { res, rej, timer });
      });
      reply.catch(() => {});
      await this.send(jsonFrame({ method, params, id }));
      return reply;
    };
    const p = this.busy.then(run, run);
    this.busy = p.catch(() => {});
    return p;
  }

  async status() {
    const r = await this.request('get-prop', ['printer-state', 'printer-sub-state', 'printer-state-alerts']);
    const v = Array.isArray(r.result) ? r.result : [];
    const state = Number(v[0]);
    const sub = Number(v[1]);
    const alerts = alertCodes(v[2]);
    return { state, sub, alerts, label: PRINTER_STATE[state] ?? `state ${state}`, subLabel: SUB_STATE[sub] ?? `${sub}` };
  }

  /** Print + kiss-cut one 4x7 sheet. Same shape as PixCut.printAndCut in protocol.mjs. */
  async printAndCut(jpeg, plt, { onStatus = () => {}, signal, timeoutMs = 8 * 60 * 1000 } = {}) {
    if (jpeg.length > MAX_JPEG_BYTES) throw new Error(`print image is ${jpeg.length} bytes; the printer takes at most 1 MiB`);
    this.error = null;
    const pre = await this.status();
    if (pre.state === 60 || pre.alerts.length) throw new Error(`printer not ready: ${describeAlerts(pre.alerts) || pre.subLabel}`);
    if (pre.state === 40) throw new Error('printer is busy with another job');

    onStatus({ phase: 'declare', text: 'declaring job' });
    const r = await this.request('combo-job', [
      { method: 'print-job', params: { channel: 2, copies: 1, 'file-size': jpeg.length, 'media-size': MEDIA_4X7, 'media-type': 2030, 'job-type': 600 } },
      { method: 'cut-job', params: { 'file-size': plt.length, 'job-type': 600 } },
    ], 10000);
    const flat = JSON.stringify(r.result ?? r.error ?? '');
    const jobId = (Array.isArray(r.result) ? r.result : [r.result]).map((v) => (v && typeof v === 'object' ? v['job-id'] : v)).map(Number).find((n) => n > 0);
    if (!jobId) {
      const err = flat.match(/"error-code"\s*:\s*(\d+)/);
      throw new Error(err ? `printer rejected the job (error ${err[1]}${ALERTS[err[1]] ? ': ' + ALERTS[err[1]] : ''})` : `no job id in reply: ${flat}`);
    }

    // cut path first, then the image, as one stream
    const payload = new Uint8Array(plt.length + jpeg.length);
    payload.set(plt);
    payload.set(jpeg, plt.length);
    const frames = dataFrames(payload, jobId);
    for (let i = 0; i < frames.length; i++) {
      if (signal?.aborted) throw new Error(`job ${jobId} cancelled during upload (the printer will time it out)`);
      await this.send(frames[i], true);
      if (i % 20 === 0 || i === frames.length - 1) onStatus({ phase: 'upload', text: `job ${jobId}: sending`, progress: (i + 1) / frames.length, jobId });
    }

    // Long replies get cut off over BLE, so only the short status is polled: done = active, then idle.
    const deadline = Date.now() + timeoutMs;
    let active = false;
    let missed = 0;
    while (Date.now() < deadline) {
      await sleep(2000);
      if (this.error) throw this.error;
      let st;
      try {
        st = await this.status();
        missed = 0;
      } catch (e) {
        if (this.error) throw this.error;
        if (++missed >= 8) {
          if (active) return { jobId, cut: true, unconfirmed: true };
          throw e;
        }
        continue;
      }
      if (st.state !== 20) active = true;
      const alert = st.alerts.length ? ` · ${describeAlerts(st.alerts)}` : '';
      onStatus({ phase: 'run', text: `job ${jobId}: ${st.label} · ${st.subLabel}${alert}`, jobId, alerts: st.alerts });
      if (st.state === 60 && st.alerts.some((c) => !(c in ALERTS))) throw new Error(`printer error: ${describeAlerts(st.alerts)}`);
      if (active && st.state === 20 && !st.alerts.length) return { jobId, cut: true };
    }
    throw new Error(`job ${jobId}: no finish seen after ${Math.round(timeoutMs / 60000)} minutes`);
  }
}
