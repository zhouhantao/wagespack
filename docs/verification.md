# 本地验证记录 · 2026-11-03

环境为 Windows 11 x64、WebView2、MSVC、Windows SDK 10.0.26100、Node 24。开发期间补装 Rust MSVC 1.99.1。桌面实际测试在单显示器 144 DPI（150%）进行。

| 阶段 | 运行与证据 | 验收边界 |
|---|---|---|
| M0 | `cargo build --locked --release --manifest-path spikes/tauri-transparent/Cargo.toml`、`pwsh -File spikes/tauri-transparent/smoke.ps1`。真实窗口验证透明角落、置顶、单击、Esc、拖动 | Alpha 为零的角落仍命中 WebView2 窗口，保留紧贴画布的小窗和独立面板。采样截图在 artifacts/m0-panel.png |
| M1 | `npm test`、`npm run e2e`。覆盖排班收入、选择角色、展开、关闭和保存恢复 | 按任务书作为当前规范。补充设计文件尚未收到 |
| M2 | `pwsh -File spikes/tauri-transparent/smoke.ps1 -Desktop -Executable artifacts/WageSpark-0.1.0-win-x64.exe`。150% 下验证实际桌宠、菜单、面板、拖拽和重启恢复 | 混合 DPI、不同任务栏方位、登录自启和托盘实际找回仍需人工验证 |
| M3 | `npm test`、`npm run e2e`。导入正常 PNG，拒绝损坏文件并保留已有角色。测试月历、休假、愿望、中英文和金额遮挡 | 单自定义角色槽，独立图像与 JSON，无压缩包。内置角色为原创占位素材 |
| M4 | `npm run build`、`cargo test --locked --release --manifest-path src-tauri/Cargo.toml`、`cargo build --locked --release --manifest-path src-tauri/Cargo.toml`。EXE 和 Web ZIP 见 artifacts/，配套 SHA256SUMS.txt | 未签名本地开发版。Windows 10、100%/200% 和多屏混合缩放、睡眠唤醒及冷启动闪帧专项测试待补 |

测试截图只使用合成薪资、原创占位角色或中性桌面背景。桌面位置恢复会把位于屏幕边缘之外的旧坐标夹到可用工作区内。

最终验证通过 10 项 Vitest、3 项 Playwright（生产预览）、2 项 Rust 单测。Windows 便携产物在本机以 150% 缩放启动并通过真实窗口冒烟测试。Web ZIP 含 index.html 和两个构建资源，Windows 文件的 PE Machine 为 x64，Authenticode 状态为 NotSigned。

## 发布前事项

确认项目名和美术分发权，补齐兼容性验证、签名决定和依赖许可文本。CI 已写入本地仓库，等待用户授权后的远程运行。发布前保留签名状态说明、校验文件、安装／启动说明和已知问题。

## 视觉修订

私人开发版采用直接提取的参考图帧，透明裁切后对齐到统一脚底基线。新增像素对话气泡，随工作状态变化，并用浏览器 E2E 验证单击后显示。UI 采用石灰色物品栏边框、草绿色按钮和格状进度条。含参考图衍生素材的构建单独存放在 artifacts/private-visual-preview/。
