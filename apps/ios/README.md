# Drill iOS 源码

目标是 SwiftUI 捕获端：本地持久化 outbox、最近对象缓存、文本／相册／录音捕获、Keychain 令牌、HTTPS 同步。不包含客户端合并、段落编辑和版本仓库。

## 在 Mac 上构建

安装 Xcode 以及 XcodeGen（工具安装方式请遵循其官方文档），然后：

```bash
cd apps/ios
xcodegen generate
open Drill.xcodeproj
```

在 Xcode 中选择自己的 Development Team、独立 Bundle Identifier，选择 iOS 17 或更新的目标设备，配置签名后运行。没有在交付包里放任何个人证书或 provisioning profile。

第一次启动先进入捕获，可以不连接后端；连接页需要可从手机访问的 HTTPS 地址，不能写桌面电脑的 localhost。自托管用服务口令，CloudBase 用已取得的访问令牌。令牌过期需要重新连接，目前没有自动刷新认证 SDK。

图片／音频／视频先存本机再入队，最大256MB；签名上传目前只支持 PUT。最近列表以文本和形态信息为主，完整移动媒体浏览尚未实现。没有后台 URLSession 队列、分享扩展或 Widget。

## 验证状态

本次在 Linux 上执行了 `swiftc -frontend -parse Drill/*.swift`，只有语法解析通过。没有 Apple SDK，不代表类型检查、链接、签名或真机运行通过。冷启动 <1秒、实际权限和媒体性能均待真机验收。
