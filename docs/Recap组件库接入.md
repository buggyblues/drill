# Recap 组件库接入

## 接入方案与范围

将用户提供的 Recap UI 0.1.0 源码引入 `packages/recap-ui`，作为 `@recap/ui` 本地 npm workspace。接入真实 React 组件，不引用包内 HTML 镜像、合成对象或示例存储。原创许可和第三方声明随包保留。

Web 和 Electron 共用 `packages/ui`，本次优化统一应用于这两个客户端的共享界面。原生 iOS 的 SwiftUI 界面未改动。

- 使用 Recap Provider、Sidebar、PageHeader、ViewToolbar、Button、IconButton、Select、Checkbox、Popover、Dialog、Sheet、SegmentedControl、Badge、Tag、Surface、EmptyState、Skeleton、SettingsSection、SettingsRow 和 Kbd。
- 统一深浅主题、语义色、圆角、字体、边框、留白、焦点样式与紧凑/舒适密度。主题和密度保存为本设备的界面偏好。
- 提供领域、项目与最近打开入口；列表、卡片和行动看板共享真实对象；详情继续使用 Drill 的属性、正文、关联和版本数据。领域/项目详情提供关联对象与范围浏览入口。
- 搜索继续走 Drill 服务端接口，增加方向键、Enter 与命令选择，并防止清空查询后旧请求覆盖结果。
- 快速创建提供可点击的保存按钮、录音入口和保存中状态，防止重复提交。关闭未提交的捕获窗口仍保留当前会话文本。
- 属性选择器使用 Base UI 的焦点、键盘与门户行为；多选即时显示选择状态，保存完成前暂停下一次修改，避免旧状态覆盖连续操作。
- 手机默认展示主内容；导航使用 Sheet，选中对象时打开详情，关闭后返回原页面。

Drill 的知识对象、归属关系、同步、服务端 API、段落编辑器和画布逻辑保持使用已有实现；不引入 Recap Demo 数据模型。正文编辑仍遵守现有客户端能力边界。

## 工程适配

`packages/ui/src/recap.css` 将现有编辑器/画布颜色变量映射到 Recap Token，并承载应用布局适配。旧样式放入 `drill` cascade layer，排在组件皮肤之前，避免宿主 reset 覆盖组件按钮。Inter 补齐 400/500/600 字重，字体和图标均随构建本地打包。

组件库入口由宿主显式加载 CSS，保证 cascade layer 顺序；图标模块添加 classic JSX 所需的 React 导入；Vite/Electron 的组件入口不包含 RSC 指令。生产包将 UI runtime 单独分块。实际依赖版本与 workspace 链接写入根目录 `package-lock.json`。

## 验证

执行并通过：

- `npm run check`：TypeScript。
- `npm run build`：Web 生产资源与 Electron main/preload 构建。
- `npm run build:preview`：同一 React UI 的本机预览。
- `npm test`：66 项数据、归属关系、HTTP、存储与同步回归。涉及本机监听的测试需在允许本机端口的环境运行。
- `scripts/verify-recap-ui.mjs`：真实无头 Chrome 的 UI 流程，结果与截图保存在 `docs/recap-ui-validation/`。该脚本只接受 demo 后端，验收对象在成功后删除；不要指向日常使用的 demo 数据目录。

复跑 UI 验收：先用单独的 `PORT`、`DEMO_DATA_DIR` 启动 `scripts/demo.ts`，然后设置 `UI_TEST_URL`。Playwright 可本地安装，或通过 `UI_PLAYWRIGHT_MODULE` 指向已有运行环境；需要可运行的 Google Chrome。截图目录可用 `UI_REPORT_DIR` 指定。

截图为真实 React 页面输出，不是原组件包的静态预览。没有声称全部 Recap 组件或 Storybook 已完整验收；也未进行 Electron 打包、签名、部署或原生 iOS 验收。
