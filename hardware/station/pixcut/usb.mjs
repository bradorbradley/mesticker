// node `usb` (libusb) transport for protocol.mjs. On Windows the PixCut S1's control and data
// interfaces (2 and 3) come up on WinUSB, so no driver install is needed.
// Adapted from brencut tools/node-usb.mjs (MIT, see LICENSE-brencut).
import { findByIds } from "usb";
import { VID, PID, CTRL, DATA, PixCut } from "./protocol.mjs";

export function openPrinter(log = () => {}) {
  const dev = findByIds(VID, PID);
  if (!dev) throw new Error("PixCut S1 not found on USB (unplugged or switched off?)");
  try {
    dev.open();
  } catch (e) {
    throw new Error(`can't open the PixCut S1 (${e.message}). Close StixCut / the Liene app: only one program can hold the printer.`);
  }
  const ifaces = [dev.interface(CTRL.iface), dev.interface(DATA.iface)];
  try {
    for (const i of ifaces) i.claim();
  } catch (e) {
    dev.close();
    throw new Error(`can't claim the PixCut S1 (${e.message}). Is the Liene app or another station holding it?`);
  }
  const eps = new Map();
  for (const i of ifaces) for (const e of i.endpoints) eps.set(e.address, e);

  const io = {
    write: (ep, bytes) => new Promise((res, rej) => {
      const e = eps.get(ep);
      e.timeout = 10000;
      e.transfer(Buffer.from(bytes), (err) => (err ? rej(err) : res()));
    }),
    read: (ep, len, timeoutMs) => new Promise((res, rej) => {
      const e = eps.get(ep);
      e.timeout = Math.round(timeoutMs);
      e.transfer(len, (err, d) => {
        if (err?.errno === 2 /* LIBUSB_TRANSFER_TIMED_OUT */ || /TIMED_OUT/.test(String(err))) return res(new Uint8Array());
        return err ? rej(err) : res(new Uint8Array(d));
      });
    }),
  };
  const close = () => new Promise((res) => {
    let n = ifaces.length;
    for (const i of ifaces) i.release(true, () => { if (--n === 0) { try { dev.close(); } catch {} res(); } });
  });
  return { printer: new PixCut(io, log), close };
}

/** Open, run `fn(printer)`, always close. */
export async function withPrinter(fn, log) {
  const { printer, close } = openPrinter(log);
  try {
    return await fn(printer);
  } finally {
    await close();
  }
}
