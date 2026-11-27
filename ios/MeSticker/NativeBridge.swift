import CoreBluetooth
import ExternalAccessory
import UIKit
import WebKit

/// Messages from bridge.js (window.webkit.messageHandlers.mesticker) to the printer links, and
/// results/events back to the page. Every request carries `cb`, answered with
/// `__mestickerNative.resolve(cb, value)` or `.reject(cb, message)`. Bytes travel as base64.
final class NativeBridge: NSObject, WKScriptMessageHandler {
    private weak var webView: WKWebView?
    private weak var presenter: UIViewController?
    private lazy var ble = BLELink(bridge: self)
    private lazy var accessory = AccessoryLink(bridge: self)

    init(webView: WKWebView, presenter: UIViewController) {
        self.webView = webView
        self.presenter = presenter
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let op = body["op"] as? String else { return }
        let cb = body["cb"] as? Int ?? -1
        if op.hasPrefix("ble.") { ble.handle(op: op, body: body, cb: cb) }
        else if op.hasPrefix("ea.") { accessory.handle(op: op, body: body, cb: cb) }
        else { reject(cb, "unknown op \(op)") }
    }

    // MARK: to the page

    func resolve(_ cb: Int, _ value: Any = NSNull()) { call("resolve", cb, value) }
    func reject(_ cb: Int, _ message: String) { call("reject", cb, message) }
    func emit(_ event: String, _ payload: [String: Any]) { call("emit", event, payload) }

    private func call(_ fn: String, _ a: Any, _ b: Any) {
        guard let data = try? JSONSerialization.data(withJSONObject: [a, b]), let args = String(data: data, encoding: .utf8) else { return }
        let js = "window.__mestickerNative && window.__mestickerNative.\(fn).apply(null, \(args))"
        DispatchQueue.main.async { self.webView?.evaluateJavaScript(js, completionHandler: nil) }
    }

    /// A native list to choose a device from (the page can't show one itself).
    func pick(title: String, options: [String], done: @escaping (Int?) -> Void) {
        DispatchQueue.main.async {
            guard let presenter = self.presenter else { return done(nil) }
            let sheet = UIAlertController(title: title, message: nil, preferredStyle: .actionSheet)
            for (i, name) in options.enumerated() { sheet.addAction(UIAlertAction(title: name, style: .default) { _ in done(i) }) }
            sheet.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in done(nil) })
            if let pop = sheet.popoverPresentationController { // iPad
                pop.sourceView = presenter.view
                pop.sourceRect = CGRect(x: presenter.view.bounds.midX, y: presenter.view.bounds.midY, width: 1, height: 1)
                pop.permittedArrowDirections = []
            }
            presenter.present(sheet, animated: true)
        }
    }
}

// MARK: - Bluetooth LE, shaped like Web Bluetooth for bridge.js

/// UUIDs cross the bridge in CoreBluetooth's short form ("FF00"), uppercased.
private func key(_ u: CBUUID) -> String { u.uuidString.uppercased() }

final class BLELink: NSObject, CBCentralManagerDelegate, CBPeripheralDelegate {
    private unowned let bridge: NativeBridge
    private var central: CBCentralManager!
    private var poweredOn: [() -> Void] = []
    private var found: [UUID: CBPeripheral] = [:]
    private var scanFilter: [String] = []
    private var peripherals: [String: CBPeripheral] = [:]
    private var connectCb: [String: Int] = [:]
    private var pendingDiscovery: [String: Int] = [:]
    private var notifyCb: [String: Int] = [:]
    private var writeCb: [String: [Int]] = [:]
    private var waitingWrites: [(CBPeripheral, CBCharacteristic, Data, Int)] = []

    init(bridge: NativeBridge) {
        self.bridge = bridge
        super.init()
        central = CBCentralManager(delegate: self, queue: .main, options: [CBCentralManagerOptionShowPowerAlertKey: true])
    }

    private func whenOn(_ f: @escaping () -> Void) {
        if central.state == .poweredOn { f() } else { poweredOn.append(f) }
    }

    func handle(op: String, body: [String: Any], cb: Int) {
        let dev = body["device"] as? String ?? ""
        switch op {
        case "ble.requestDevice":
            scanFilter = (body["namePrefixes"] as? [String]) ?? []
            whenOn { self.scanAndPick(cb: cb) }
        case "ble.connect":
            guard let p = peripheral(dev, cb) else { return }
            connectCb[dev] = cb
            central.connect(p)
        case "ble.disconnect":
            if let p = peripherals[dev] { central.cancelPeripheralConnection(p) }
            bridge.resolve(cb)
        case "ble.startNotifications":
            guard let p = peripheral(dev, cb), let c = characteristic(p, body, cb) else { return }
            notifyCb["\(dev)/\(key(c.uuid))"] = cb
            p.setNotifyValue(true, for: c)
        case "ble.write":
            guard let p = peripheral(dev, cb), let c = characteristic(p, body, cb) else { return }
            let data = Data(base64Encoded: body["data"] as? String ?? "") ?? Data()
            if body["withResponse"] as? Bool == true {
                writeCb["\(dev)/\(key(c.uuid))", default: []].append(cb)
                p.writeValue(data, for: c, type: .withResponse)
            } else if waitingWrites.isEmpty && p.canSendWriteWithoutResponse {
                p.writeValue(data, for: c, type: .withoutResponse)
                bridge.resolve(cb)
            } else {
                waitingWrites.append((p, c, data, cb))
            }
        default:
            bridge.reject(cb, "unknown op \(op)")
        }
    }

    private func peripheral(_ id: String, _ cb: Int) -> CBPeripheral? {
        if let p = peripherals[id] { return p }
        bridge.reject(cb, "printer not found")
        return nil
    }

    private func characteristic(_ p: CBPeripheral, _ body: [String: Any], _ cb: Int) -> CBCharacteristic? {
        let s = (body["service"] as? String ?? "").uppercased(), c = (body["characteristic"] as? String ?? "").uppercased()
        if let ch = p.services?.first(where: { key($0.uuid) == s })?.characteristics?.first(where: { key($0.uuid) == c }) { return ch }
        bridge.reject(cb, "printer has no characteristic \(c)")
        return nil
    }

    private func scanAndPick(cb: Int) {
        found = [:]
        // already connected to iOS (e.g. by another app): include those too
        for p in central.retrieveConnectedPeripherals(withServices: [CBUUID(string: "FF00")]) where matches(p.name) { found[p.identifier] = p }
        central.scanForPeripherals(withServices: nil, options: nil)
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
            self.central.stopScan()
            let list = Array(self.found.values).sorted { ($0.name ?? "") < ($1.name ?? "") }
            if list.isEmpty { return self.bridge.reject(cb, "No printer found. Is it on and nearby? Close the Liene app.") }
            let choose = { (p: CBPeripheral) in
                self.peripherals[p.identifier.uuidString] = p
                self.bridge.resolve(cb, ["id": p.identifier.uuidString, "name": p.name ?? "Printer"])
            }
            if list.count == 1 { return choose(list[0]) }
            self.bridge.pick(title: "Choose the printer", options: list.map { $0.name ?? "Printer" }) { i in
                if let i { choose(list[i]) } else { self.bridge.reject(cb, "cancelled") }
            }
        }
    }

    private func matches(_ name: String?) -> Bool {
        guard let name else { return false }
        return scanFilter.isEmpty || scanFilter.contains { name.hasPrefix($0) }
    }

    // MARK: CBCentralManagerDelegate

    func centralManagerDidUpdateState(_ c: CBCentralManager) {
        guard c.state == .poweredOn else { return }
        let waiting = poweredOn
        poweredOn = []
        waiting.forEach { $0() }
    }

    func centralManager(_ c: CBCentralManager, didDiscover p: CBPeripheral, advertisementData: [String: Any], rssi: NSNumber) {
        let name = p.name ?? advertisementData[CBAdvertisementDataLocalNameKey] as? String
        if matches(name) { found[p.identifier] = p }
    }

    func centralManager(_ c: CBCentralManager, didConnect p: CBPeripheral) {
        p.delegate = self
        pendingDiscovery[p.identifier.uuidString] = 0
        p.discoverServices(nil)
    }

    func centralManager(_ c: CBCentralManager, didFailToConnect p: CBPeripheral, error: Error?) {
        if let cb = connectCb.removeValue(forKey: p.identifier.uuidString) { bridge.reject(cb, error?.localizedDescription ?? "couldn't connect") }
    }

    func centralManager(_ c: CBCentralManager, didDisconnectPeripheral p: CBPeripheral, error: Error?) {
        let id = p.identifier.uuidString
        if let cb = connectCb.removeValue(forKey: id) { bridge.reject(cb, "disconnected") }
        waitingWrites.removeAll { $0.0 == p }
        bridge.emit("ble.disconnected", ["device": id])
    }

    // MARK: CBPeripheralDelegate

    func peripheral(_ p: CBPeripheral, didDiscoverServices error: Error?) {
        let services = p.services ?? []
        pendingDiscovery[p.identifier.uuidString] = services.count
        if services.isEmpty { finishDiscovery(p) }
        services.forEach { p.discoverCharacteristics(nil, for: $0) }
    }

    func peripheral(_ p: CBPeripheral, didDiscoverCharacteristicsFor s: CBService, error: Error?) {
        let id = p.identifier.uuidString
        pendingDiscovery[id, default: 1] -= 1
        if pendingDiscovery[id]! <= 0 { finishDiscovery(p) }
    }

    private func finishDiscovery(_ p: CBPeripheral) {
        let id = p.identifier.uuidString
        guard let cb = connectCb.removeValue(forKey: id) else { return }
        var services: [String: [String]] = [:]
        for s in p.services ?? [] { services[key(s.uuid)] = (s.characteristics ?? []).map { key($0.uuid) } }
        bridge.resolve(cb, ["services": services, "mtu": p.maximumWriteValueLength(for: .withoutResponse)])
    }

    func peripheral(_ p: CBPeripheral, didUpdateNotificationStateFor c: CBCharacteristic, error: Error?) {
        if let cb = notifyCb.removeValue(forKey: "\(p.identifier.uuidString)/\(key(c.uuid))") {
            if let error { bridge.reject(cb, error.localizedDescription) } else { bridge.resolve(cb) }
        }
    }

    func peripheral(_ p: CBPeripheral, didUpdateValueFor c: CBCharacteristic, error: Error?) {
        guard let v = c.value else { return }
        bridge.emit("ble.value", ["device": p.identifier.uuidString, "characteristic": key(c.uuid), "data": v.base64EncodedString()])
    }

    func peripheral(_ p: CBPeripheral, didWriteValueFor c: CBCharacteristic, error: Error?) {
        let k = "\(p.identifier.uuidString)/\(key(c.uuid))"
        guard var list = writeCb[k], !list.isEmpty else { return }
        let cb = list.removeFirst()
        writeCb[k] = list
        if let error { bridge.reject(cb, error.localizedDescription) } else { bridge.resolve(cb) }
    }

    func peripheralIsReady(toSendWriteWithoutResponse p: CBPeripheral) {
        while let next = waitingWrites.first, next.0 == p, p.canSendWriteWithoutResponse {
            waitingWrites.removeFirst()
            p.writeValue(next.2, for: next.1, type: .withoutResponse)
            bridge.resolve(next.3)
        }
    }
}

// MARK: - Classic Bluetooth (ExternalAccessory): the Liene app's own link

final class AccessoryLink: NSObject, StreamDelegate {
    private unowned let bridge: NativeBridge
    private var session: EASession?
    private var outBuffer = Data()
    private var writeWaiters: [(Int, Int)] = [] // (cb, bytes left to write up to and including its own)

    private var protocols: [String] {
        (Bundle.main.object(forInfoDictionaryKey: "UISupportedExternalAccessoryProtocols") as? [String] ?? []).filter { !$0.hasPrefix("REPLACE") }
    }

    init(bridge: NativeBridge) {
        self.bridge = bridge
        super.init()
        NotificationCenter.default.addObserver(self, selector: #selector(disconnected(_:)), name: .EAAccessoryDidDisconnect, object: nil)
        EAAccessoryManager.shared().registerForLocalNotifications()
    }

    func handle(op: String, body: [String: Any], cb: Int) {
        switch op {
        case "ea.available":
            bridge.resolve(cb, ["protocols": protocols, "connected": EAAccessoryManager.shared().connectedAccessories.map { ["name": $0.name, "protocols": $0.protocolStrings] }])
        case "ea.open":
            open(cb: cb)
        case "ea.write":
            guard let out = session?.outputStream else { return bridge.reject(cb, "printer not connected") }
            let data = Data(base64Encoded: body["data"] as? String ?? "") ?? Data()
            outBuffer.append(data)
            writeWaiters.append((cb, outBuffer.count))
            pump(out)
        case "ea.close":
            close()
            bridge.resolve(cb)
        default:
            bridge.reject(cb, "unknown op \(op)")
        }
    }

    private func open(cb: Int) {
        guard !protocols.isEmpty else { return bridge.reject(cb, "The app doesn't know the printer's protocol name yet (Info.plist)") }
        close()
        if let acc = EAAccessoryManager.shared().connectedAccessories.first(where: { !Set($0.protocolStrings).isDisjoint(with: protocols) }) {
            return start(acc, cb: cb)
        }
        // not connected to iOS yet: Apple's own Bluetooth accessory picker
        EAAccessoryManager.shared().showBluetoothAccessoryPicker(withNameFilter: nil) { error in
            if let acc = EAAccessoryManager.shared().connectedAccessories.first(where: { !Set($0.protocolStrings).isDisjoint(with: self.protocols) }) {
                self.start(acc, cb: cb)
            } else {
                self.bridge.reject(cb, error.map { "No printer: \($0.localizedDescription)" } ?? "No printer chosen. Pair it in Settings → Bluetooth, then try again.")
            }
        }
    }

    private func start(_ acc: EAAccessory, cb: Int) {
        guard let proto = acc.protocolStrings.first(where: { protocols.contains($0) }), let s = EASession(accessory: acc, forProtocol: proto) else {
            return bridge.reject(cb, "Couldn't open the printer. Close the Liene app and try again.")
        }
        session = s
        for stream in [s.inputStream, s.outputStream].compactMap({ $0 }) {
            stream.delegate = self
            stream.schedule(in: .main, forMode: .default)
            stream.open()
        }
        bridge.resolve(cb, ["name": acc.name, "protocol": proto])
    }

    private func pump(_ out: OutputStream) {
        while !outBuffer.isEmpty && out.hasSpaceAvailable {
            let n = outBuffer.withUnsafeBytes { out.write($0.bindMemory(to: UInt8.self).baseAddress!, maxLength: outBuffer.count) }
            if n <= 0 { break }
            outBuffer.removeFirst(n)
            writeWaiters = writeWaiters.map { ($0.0, $0.1 - n) }
        }
        // a write resolves once its bytes are handed to the system, so the page paces itself
        while let w = writeWaiters.first, w.1 <= 0 {
            writeWaiters.removeFirst()
            bridge.resolve(w.0)
        }
    }

    func stream(_ s: Stream, handle event: Stream.Event) {
        switch event {
        case .hasBytesAvailable:
            guard let input = s as? InputStream else { return }
            var buf = [UInt8](repeating: 0, count: 4096)
            var chunk = Data()
            while input.hasBytesAvailable {
                let n = input.read(&buf, maxLength: buf.count)
                if n <= 0 { break }
                chunk.append(buf, count: n)
            }
            if !chunk.isEmpty { bridge.emit("ea.data", ["data": chunk.base64EncodedString()]) }
        case .hasSpaceAvailable:
            if let out = s as? OutputStream { pump(out) }
        case .errorOccurred, .endEncountered:
            close()
            bridge.emit("ea.closed", [:])
        default:
            break
        }
    }

    @objc private func disconnected(_ n: Notification) {
        guard session != nil else { return }
        close()
        bridge.emit("ea.closed", [:])
    }

    private func close() {
        for stream in [session?.inputStream, session?.outputStream].compactMap({ $0 }) {
            stream.close()
            stream.remove(from: .main, forMode: .default)
        }
        session = nil
        outBuffer.removeAll()
        writeWaiters.forEach { bridge.reject($0.0, "printer connection lost") }
        writeWaiters.removeAll()
    }
}
