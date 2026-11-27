// Injected into every mesticker.fun page by the MeSticker iOS app (NativeBridge.swift).
//  - navigator.bluetooth: the part of Web Bluetooth the printer code uses (hardware/station/pixcut/ble.mjs)
//  - window.mestickerNative.accessory: the classic-Bluetooth byte stream (hardware/station/pixcut/stream.mjs)
(() => {
  if (window.__mestickerNative || !window.webkit?.messageHandlers?.mesticker) return;
  const post = window.webkit.messageHandlers.mesticker;
  let nextCb = 1;
  const calls = new Map();
  const listeners = {};

  const call = (op, args = {}) =>
    new Promise((resolve, reject) => {
      const cb = nextCb++;
      calls.set(cb, { resolve, reject });
      post.postMessage({ op, cb, ...args });
    });

  const b64 = (bytes) => {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  };
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const asBytes = (v) => (v instanceof Uint8Array ? v : ArrayBuffer.isView(v) ? new Uint8Array(v.buffer, v.byteOffset, v.byteLength) : new Uint8Array(v));
  // "0000ff00-0000-1000-8000-00805f9b34fb" / 0xff00 / "ff00" → "FF00" (CoreBluetooth's short form)
  const short = (u) => {
    if (typeof u === 'number') return u.toString(16).toUpperCase().padStart(4, '0');
    const m = String(u).toLowerCase().match(/^0000([0-9a-f]{4})-0000-1000-8000-00805f9b34fb$/);
    return (m ? m[1] : String(u)).toUpperCase();
  };

  window.__mestickerNative = {
    resolve(cb, value) { const c = calls.get(cb); calls.delete(cb); c?.resolve(value); },
    reject(cb, message) { const c = calls.get(cb); calls.delete(cb); c?.reject(new Error(message)); },
    emit(event, payload) { (listeners[event] || []).forEach((f) => f(payload)); },
  };
  const on = (event, f) => (listeners[event] ||= []).push(f);

  // ---------------------------------------------------------------- Bluetooth LE (Web Bluetooth shape)

  class Characteristic extends EventTarget {
    constructor(device, service, uuid) {
      super();
      this.device = device; this.serviceUuid = service; this.uuid = uuid; this.value = null;
    }
    startNotifications() { return call('ble.startNotifications', { device: this.device.id, service: this.serviceUuid, characteristic: this.uuid }).then(() => this); }
    writeValueWithoutResponse(v) { return call('ble.write', { device: this.device.id, service: this.serviceUuid, characteristic: this.uuid, data: b64(asBytes(v)), withResponse: false }); }
    writeValueWithResponse(v) { return call('ble.write', { device: this.device.id, service: this.serviceUuid, characteristic: this.uuid, data: b64(asBytes(v)), withResponse: true }); }
    writeValue(v) { return this.writeValueWithResponse(v); }
  }

  class Device extends EventTarget {
    constructor(id, name) {
      super();
      this.id = id; this.name = name; this.chars = new Map(); this.services = {};
      const device = this;
      this.gatt = {
        connected: false,
        device,
        async connect() {
          const r = await call('ble.connect', { device: device.id });
          device.services = r.services || {};
          this.connected = true;
          return this;
        },
        disconnect() { this.connected = false; call('ble.disconnect', { device: device.id }).catch(() => {}); },
        async getPrimaryService(uuid) {
          const s = short(uuid);
          if (!device.services[s]) throw new Error(`printer has no service ${s}`);
          return {
            uuid: s,
            async getCharacteristic(cu) {
              const c = short(cu);
              if (!device.services[s].includes(c)) throw new Error(`printer has no characteristic ${c}`);
              const k = `${s}/${c}`;
              if (!device.chars.has(k)) device.chars.set(k, new Characteristic(device, s, c));
              return device.chars.get(k);
            },
          };
        },
      };
    }
  }

  const devices = new Map();
  on('ble.value', ({ device, characteristic, data }) => {
    const d = devices.get(device);
    if (!d) return;
    const bytes = unb64(data);
    for (const [k, ch] of d.chars) {
      if (!k.endsWith(`/${characteristic}`)) continue;
      ch.value = new DataView(bytes.buffer);
      ch.dispatchEvent(new Event('characteristicvaluechanged'));
    }
  });
  on('ble.disconnected', ({ device }) => {
    const d = devices.get(device);
    if (!d) return;
    d.gatt.connected = false;
    d.dispatchEvent(new Event('gattserverdisconnected'));
  });

  const bluetooth = {
    async getAvailability() { return true; },
    async requestDevice(options = {}) {
      const namePrefixes = (options.filters || []).map((f) => f.namePrefix || f.name).filter(Boolean);
      const r = await call('ble.requestDevice', { namePrefixes });
      const d = devices.get(r.id) || new Device(r.id, r.name);
      devices.set(r.id, d);
      return d;
    },
  };
  try {
    Object.defineProperty(navigator, 'bluetooth', { value: bluetooth, configurable: true });
  } catch { /* already defined */ }

  // ---------------------------------------------------------------- classic Bluetooth (byte stream)

  const dataSubs = new Set();
  const closeSubs = new Set();
  on('ea.data', ({ data }) => { const bytes = unb64(data); dataSubs.forEach((f) => f(bytes)); });
  on('ea.closed', () => closeSubs.forEach((f) => f()));

  window.mestickerNative = {
    app: 'ios',
    accessory: {
      available: () => call('ea.available'),
      async open() {
        await call('ea.open');
        dataSubs.clear();
        closeSubs.clear();
        return {
          write: (bytes) => call('ea.write', { data: b64(asBytes(bytes)) }),
          onData: (f) => dataSubs.add(f),
          onClose: (f) => closeSubs.add(f),
          close: () => call('ea.close'),
        };
      },
    },
  };
})();
