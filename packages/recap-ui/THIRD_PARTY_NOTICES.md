# Third-party notices and reference boundaries

本仓库的 MIT 许可仅覆盖本次原创实现与自制演示素材，不重新授予第三方商标、上游软件或用户输入素材的权利。

## 依赖

package.json 声明 React/ReactDOM、Base UI、clsx、tailwind-merge，以及开发工具 Storybook、Tailwind CSS、Vite、TypeScript、Vitest、Testing Library、Playwright、axe 等。它们没有随源码 ZIP 一并复制；安装后应阅读各包的 LICENSE/NOTICE，并在再分发构建产物前审计实际锁定版本与传递依赖。此文档不是已经完成 npm 许可证审计的报告。

官方项目链接与采用原因见 docs/research-sources.json。公开文档只作为研究依据，包内不是其全文镜像。

## 参考素材

Capacities 截图与走查说明由用户提供，只用于本次分析和原创实现。Capacities 名称用于指明参考来源，不代表合作、授权、从属或官方实现。原应用的逆向产物、源码包、日志、私有 workspace URL、用户截图、字体二进制没有被复制到交付包。

docs/screenshot-provenance.json 保留图号、标题、可用性、哈希和映射说明以便用户核对原包；不保留私有应用路由。视觉尺寸和颜色属于本项目设计值，不声称为 Capacities 官方 Token。

## 自制素材

public/assets/still-life.svg 为原创 SVG；public/assets/study-tone.wav 为本包生成的合成音；src/app/data.ts 内容和人物名称为演示虚构。预览 PNG 来自本包 HTML 镜像，并非用户原截图。

## 字体

没有附带或重新分发任何字体文件。CSS 只引用系统字体栈以及设备已经安装的字体名称；不从外部字体服务下载。
