import SwiftUI
import PhotosUI
import AVFoundation
import UniformTypeIdentifiers

@main struct DrillApp: App {
    @StateObject private var store = MobileStore()
    @Environment(\.scenePhase) private var phase
    var body: some Scene {
        WindowGroup {
            MobileRoot().environmentObject(store).tint(Color.primary)
                .onChange(of: phase) { _, value in if value == .active { Task { await store.sync() } } }
        }
    }
}
struct MobileRoot: View {
    @EnvironmentObject var store: MobileStore
    @State private var text = ""
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var recorder: AVAudioRecorder?
    @State private var recording = false
    var body: some View {
        TabView {
            NavigationStack {
                VStack(alignment: .leading, spacing: 22) {
                    Text("先放下。").font(.system(size: 40, weight: .medium)).padding(.top, 24)
                    Text("不用选择类型，也不用先想清楚。").font(.subheadline).foregroundStyle(.secondary)
                    TextEditor(text: $text).font(.title3).frame(minHeight: 140, maxHeight: 220).scrollContentBackground(.hidden).padding(12).background(Color(.secondarySystemGroupedBackground)).clipShape(RoundedRectangle(cornerRadius: 13))
                    HStack {
                        PhotosPicker(selection: $selectedPhoto, matching: .any(of: [.images, .videos])) { Image(systemName: "photo").font(.title3).accessibilityLabel("放入图片或视频") }
                        Button { Task { await toggleRecording() } } label: { Image(systemName: recording ? "stop.circle.fill" : "mic").font(.title3) }.padding(.leading, 15).accessibilityLabel(recording ? "停止录音" : "开始录音")
                        Spacer()
                        Button("存下") { let before = store.state.outbox.count; store.capture(text); if store.state.outbox.count > before { text = "" } }.buttonStyle(.borderedProminent).disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                    Text(recording ? "正在录音，点击停止才会保存。" : store.message).font(.caption).foregroundStyle(.secondary)
                    Spacer()
                    Text("本机先保存，回到网络里再同步。").font(.caption2).foregroundStyle(.tertiary)
                }.padding(26).background(Color(.systemGroupedBackground)).navigationTitle("drill").navigationBarTitleDisplayMode(.inline)
                    .onChange(of: selectedPhoto) { _, item in
                        Task { do { if let data = try await item?.loadTransferable(type: Data.self) { let type = item?.supportedContentTypes.first; store.captureMedia(data, title: type?.conforms(to: .movie) == true ? "一段视频" : "一张图片", mime: type?.preferredMIMEType ?? "image/jpeg") } } catch { store.message = "媒体读取失败：\(error.localizedDescription)" } }
                    }
            }.tabItem { Label("放下", systemImage: "plus") }
            NavigationStack {
                List(store.state.items.filter { $0.deleted_at == nil && !$0.ephemeral }) { item in
                    NavigationLink { ScrollView { VStack(alignment: .leading, spacing: 22) { Text(item.title).font(.title2); Text(item.body).font(.body); Text("附文只读；提炼与完整整理请回到桌面。").font(.caption).foregroundStyle(.secondary) }.frame(maxWidth: .infinity, alignment: .leading).padding(25) }.navigationTitle("内容").navigationBarTitleDisplayMode(.inline) } label: {
                        VStack(alignment: .leading, spacing: 8) { Text(item.title).lineLimit(2); Text(Date(timeIntervalSince1970: item.captured_at / 1000), style: .date).font(.caption2).foregroundStyle(.tertiary) }.padding(.vertical, 6)
                    }
                }.navigationTitle("最近的内容").refreshable { await store.sync() }
            }.tabItem { Label("最近", systemImage: "clock") }
            ConnectionView().tabItem { Label("连接", systemImage: "circle.grid.2x2") }
        }
    }
    private func toggleRecording() async {
        if recording, let recorder { recorder.stop(); recording = false; do { store.captureMedia(try Data(contentsOf: recorder.url), title: "一段录音", mime: "audio/mp4") } catch { store.message = error.localizedDescription }; return }
        let granted = await withCheckedContinuation { continuation in AVAudioSession.sharedInstance().requestRecordPermission { continuation.resume(returning: $0) } }
        guard granted else { store.message = "麦克风权限未开启"; return }
        do {
            let session = AVAudioSession.sharedInstance(); try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker]); try session.setActive(true)
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".m4a")
            let r = try AVAudioRecorder(url: url, settings: [AVFormatIDKey: kAudioFormatMPEG4AAC, AVSampleRateKey: 44100, AVNumberOfChannelsKey: 1, AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue])
            guard r.record() else { throw MobileError(message: "录音无法开始") }; recorder = r; recording = true
        } catch { store.message = error.localizedDescription }
    }
}
struct ConnectionView: View {
    @EnvironmentObject var store: MobileStore
    @State private var url = "", password = "", token = ""
    var body: some View {
        NavigationStack {
            Form {
                Section("同一个后端") {
                    TextField("https://你的服务地址", text: $url).keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
                    SecureField("自托管连接口令", text: $password)
                    SecureField("或 CloudBase access_token", text: $token)
                    Button("连接并同步") { Task { await store.connect(url: url, password: password, accessToken: token); password = ""; token = "" } }.disabled(store.syncing)
                }
                Section { Text(store.message).font(.footnote); Button("同步一次") { Task { await store.sync() } }.disabled(store.syncing) }
                Section { Text("凭据保存在系统钥匙串。缓存只保留最近150条和未同步捕获；移动端不编辑正文、不合并冲突、不显示版本。").font(.footnote).foregroundStyle(.secondary) }
            }.navigationTitle("连接").onAppear { url = store.state.baseURL ?? "" }
        }
    }
}
