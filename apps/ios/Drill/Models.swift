import Foundation

indirect enum JSONValue: Codable {
    case string(String), number(Double), bool(Bool), object([String: JSONValue]), array([JSONValue]), null
    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let v = try? c.decode(Bool.self) { self = .bool(v) }
        else if let v = try? c.decode(Double.self) { self = .number(v) }
        else if let v = try? c.decode(String.self) { self = .string(v) }
        else if let v = try? c.decode([String: JSONValue].self) { self = .object(v) }
        else { self = .array(try c.decode([JSONValue].self)) }
    }
    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .string(let v): try c.encode(v)
        case .number(let v): try c.encode(v)
        case .bool(let v): try c.encode(v)
        case .object(let v): try c.encode(v)
        case .array(let v): try c.encode(v)
        case .null: try c.encodeNil()
        }
    }
    var string: String? { if case .string(let v) = self { return v }; return nil }
    var object: [String: JSONValue]? { if case .object(let v) = self { return v }; return nil }
}
struct Item: Identifiable, Codable {
    var id: String; var title: String; var body: String; var form: String
    var kind: String?; var captured_at: Double; var rev: Int; var deleted_at: Double?
    var ephemeral: Bool = false
}
struct Mutation: Codable, Identifiable {
    var mutation_id: String; var object_id: String; var field: String
    var value: JSONValue; var base_rev: Int; var client_ts: Double
    var id: String { mutation_id }
}
struct QueuedAsset: Codable, Identifiable {
    var id: String; var filename: String; var mime: String; var hash: String; var size: Int
    var remoteID: String?
}
struct MobileState: Codable {
    var items: [Item] = []
    var outbox: [Mutation] = []
    var assets: [QueuedAsset] = []
    var device = "ios-" + UUID().uuidString.lowercased()
    var owner: String?
    var baseURL: String?
}
struct PullResult: Decodable { var objects: [Item]; var latest_seq: Int }
struct PushResult: Decodable { var acknowledged: [String] }
struct MobileError: LocalizedError { var message: String; var errorDescription: String? { message } }
