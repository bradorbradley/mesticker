// PixCut S1 over a plain byte stream: the MeSticker iOS app's classic Bluetooth link (the same
// connection the Liene phone app uses, through Apple's ExternalAccessory). Much faster than
// Bluetooth LE: 892-byte frames with no per-frame acknowledgement. Frame format and job
// description from github.com/sincethestudy/liene-pixcut-s1-api (classic Bluetooth on macOS).
//
// `link` is { write(Uint8Array) -> Promise, onData(cb), onClose(cb), close() }, provided by the app
// as window.mestickerNative.accessory (see ios/MeSticker/bridge.js).
import { PixCutBle } from './ble.mjs';

export const STREAM = { chunk: 892, pacingMs: 8, channel: 528 };

export const supported = () => typeof window !== 'undefined' && !!window.mestickerNative?.accessory;

export async function openPrinter(log = () => {}) {
  const link = await window.mestickerNative.accessory.open();
  const printer = new PixCutBle((bytes) => link.write(bytes), log, { chunk: STREAM.chunk, ack: false, pacingMs: STREAM.pacingMs, channel: STREAM.channel, extra: true });
  // PixCutBle only needs writeValue; adapt the function to that shape
  printer.write = { writeValue: (bytes) => link.write(bytes) };
  link.onData((bytes) => printer.onData(bytes));
  link.onClose(() => printer.fail(new Error('printer connection lost')));
  return { printer, close: () => link.close() };
}
