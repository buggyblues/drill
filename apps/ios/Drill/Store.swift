import Foundation
import SwiftUI
import CryptoKit

/// Capture-only client. The server is the only merge authority.
@MainActor final class MobileStore: ObservableObject {
    @Published var state = MobileState()
    @Published var message = ""
    @Published var syncing = false
    private var recoveryRequired = false
    private let directory: URL
    private let file: URL
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    init() {
        directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("Drill", isDirectory: true)
        file = directory.appendingPathComponent("cache-and-outbox.json")
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            if FileManager.default.fileExists(atPath: file.path) {
                // A small recent cache is loaded before any network request.
                state = try decoder.decode(MobileState.self, from: Data(contentsOf: file))
            }
        } catch { recoveryRequired = true; message = "本机缓存暂时无法读取；已锁定写入，请先备份并修复缓存。\(error.localizedDescription)" }
    }
    private func persist() throws {
        guard !recoveryRequired else { throw MobileError(message: "缓存恢复前禁止覆盖原文件") }
        let data = try encoder.encode(state)
        try data.write(to: file, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }
    func capture(_ text: String, assetID: String? = nil, form suppliedForm: String? = nil) {
        let text = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        let before = state
        let lines = text.components(separatedBy: .newlines)
        let title = lines.first ?? text, body = lines.dropFirst().joined(separator: "\n")
        let now = floor(Date().timeIntervalSince1970 * 1000)
        let id = UUID().uuidString.lowercased()
        let form = suppliedForm ?? ((URL(string: title)?.scheme.map { ["https", "http"].contains($0) } ?? false) ? "link" : "text")
        var object: [String: JSONValue] = ["id": .string(id), "title": .string(title), "body": .string(body), "form": .string(form), "captured_at": .number(now)]
        if let assetID { object["asset_id"] = .string(assetID) }
        state.outbox.append(Mutation(mutation_id: UUID().uuidString.lowercased(), object_id: id, field: "create", value: .object(object), base_rev: 0, client_ts: now))
        state.items.insert(Item(id: id, title: title, body: body, form: form, kind: nil, captured_at: now, rev: 0, deleted_at: nil), at: 0)
        do { try persist(); message = "已经放下。" } catch { state = before; message = "本机保存失败，内容尚未存下：\(error.localizedDescription)" }
    }
    func captureMedia(_ data: Data, title: String, mime: String) {
        guard !recoveryRequired else { message = "先恢复本机缓存，再捕获媒体"; return }
        guard data.count <= 256 * 1024 * 1024 else { message = "媒体大于256MB，请改用桌面端"; return }
        do {
            let id = UUID().uuidString.lowercased(), filename = id + ".media"
            try data.write(to: directory.appendingPathComponent(filename), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
            let hash = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
            state.assets.append(QueuedAsset(id: id, filename: filename, mime: mime, hash: hash, size: data.count))
            capture(title, assetID: id, form: mime.components(separatedBy: "/").first)
        } catch { message = "媒体尚未保存：\(error.localizedDescription)" }
    }
    private func request(_ path: String, method: String = "GET", body: [String: JSONValue]? = nil, origin: String? = nil, token: String? = nil) async throws -> Data {
        guard let base = origin ?? state.baseURL, let url = URL(string: base + path) else { throw MobileError(message: "先连接后端，本地捕获仍可使用") }
        var request = URLRequest(url: url); request.httpMethod = method; request.timeoutInterval = 30
        request.setValue("Bearer " + (token ?? Keychain.read() ?? ""), forHTTPHeaderField: "Authorization")
        if let body { request.httpBody = try encoder.encode(body); request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let error = (try? decoder.decode([String: JSONValue].self, from: data))?["error"]?.string
            throw MobileError(message: error ?? "服务不可用，内容保留在本机")
        }
        return data
    }
    func connect(url: String, password: String, accessToken: String) async {
        do {
            guard !recoveryRequired else { throw MobileError(message: "先恢复本机缓存，再连接后端") }
            guard let u = URL(string: url), u.scheme == "https", u.host != nil, u.user == nil, u.password == nil, u.query == nil, u.fragment == nil else { throw MobileError(message: "iOS请使用没有路径参数的HTTPS服务地址") }
            let origin = url.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            if let old = state.baseURL, old != origin { throw MobileError(message: "不可混合两个后端，请使用独立的数据环境") }
            var token = accessToken
            if token.isEmpty {
                let response = try await request("/auth/login", method: "POST", body: ["password": .string(password)], origin: origin)
                token = (try decoder.decode([String: JSONValue].self, from: response))["token"]?.string ?? ""
            }
            let bootstrap = try await request("/bootstrap", origin: origin, token: token)
            let result = try decoder.decode([String: JSONValue].self, from: bootstrap)
            guard let owner = result["user"]?.object?["id"]?.string else { throw MobileError(message: "不是可识别的Drill后端") }
            if let previous = state.owner, previous != owner { throw MobileError(message: "此缓存属于另一用户") }
            try Keychain.write(token); state.baseURL = origin; state.owner = owner; try persist()
            await sync()
        } catch { message = error.localizedDescription }
    }
    private func uploadAssets() async throws {
        for a in state.assets where a.remoteID == nil {
            let raw = try await request("/assets/sign", method: "POST", body: ["size": .number(Double(a.size)), "mime": .string(a.mime), "hash": .string(a.hash)])
            let signed = try decoder.decode([String: JSONValue].self, from: raw)
            guard let id = signed["asset_id"]?.string else { throw MobileError(message: "无法取得媒体签名") }
            if case .bool(true)? = signed["deduplicated"] {} else {
                guard let grant = signed["upload_token"]?.object, let href = grant["url"]?.string, let url = URL(string: href), grant["method"]?.string == "PUT" else { throw MobileError(message: "移动端直传需要PUT签名，请核对存储配置") }
                var upload = URLRequest(url: url); upload.httpMethod = "PUT"; upload.timeoutInterval = 300
                for (key, value) in grant["headers"]?.object ?? [:] { upload.setValue(value.string, forHTTPHeaderField: key) }
                let (_, response) = try await URLSession.shared.upload(for: upload, fromFile: directory.appendingPathComponent(a.filename))
                guard let response = response as? HTTPURLResponse, (200..<300).contains(response.statusCode) else { throw MobileError(message: "媒体上传失败，本机文件没有删除") }
                _ = try await request("/assets/commit", method: "POST", body: ["asset_id": .string(id), "hash": .string(a.hash), "size": .number(Double(a.size))])
            }
            if let i = state.assets.firstIndex(where: { $0.id == a.id }) { state.assets[i].remoteID = id }
            for i in state.outbox.indices {
                if var v = state.outbox[i].value.object, v["asset_id"]?.string == a.id { v["asset_id"] = .string(id); state.outbox[i].value = .object(v) }
            }
            try persist()
        }
    }
    func sync() async {
        guard !recoveryRequired, !syncing, state.baseURL != nil else { return }; syncing = true
        defer { syncing = false }
        do {
            try await uploadAssets()
            while !state.outbox.isEmpty {
                let batch = Array(state.outbox.prefix(100))
                let changes = try decoder.decode(JSONValue.self, from: encoder.encode(batch))
                let data = try await request("/sync/push", method: "POST", body: ["device_id": .string(state.device), "changes": changes])
                let result = try decoder.decode(PushResult.self, from: data), ids = Set(result.acknowledged).intersection(batch.map(\.id))
                guard !ids.isEmpty else { throw MobileError(message: "服务端未确认离线批次") }
                state.outbox.removeAll { ids.contains($0.id) }; try persist()
            }
            // Fetch the bounded recent list, not a full desktop replica. Pending new captures are preserved.
            let data = try await request("/objects?limit=150")
            struct Recent: Decodable { var objects: [Item] }
            let recent = try decoder.decode(Recent.self, from: data)
            let pendingIDs = Set(state.outbox.map(\.object_id)), pending = state.items.filter { pendingIDs.contains($0.id) }
            state.items = (pending + recent.objects.filter { !pendingIDs.contains($0.id) }).filter { $0.deleted_at == nil && !$0.ephemeral }
            try persist(); message = "已与后端同步。"
        } catch { message = "本地可用 · \(error.localizedDescription)" }
    }
}
