# wagespack

wagespack 是一个本地优先的像素桌宠。单击桌宠打开估算收入、下班倒计时、工作进度和愿望面板。按 Esc 或点 × 收起。Windows 版支持拖动角色、托盘找回与保存位置。

当前为本地开发版。Windows 11 x64 需要 WebView2。第一次展开时可以选择角色；在「设置」中填写自己的薪资和排班。薪资均为估算。

## 本地运行

从 [GitHub Releases](https://github.com/zhouhantao/wagespack/releases) 获取 Windows x64 便携版，解压后双击 `wagespack.exe`。应用需要 WebView2，当前构建未签名。如果上一版仍在运行，先在旧桌宠或托盘菜单选择退出。新版启动后，单击小人切换姿势并打开面板，拖住小人可移动位置。可在设置关闭动画或空闲自动互动，也可以更换主题。

从源码启动或构建时，在项目目录运行对应命令。

```powershell
npm ci
npm run dev
npm test
npm run e2e
npm run build
cargo build --locked --release --manifest-path src-tauri/Cargo.toml
```

Web 生产文件位于 `dist/`，用本地静态服务器打开。Windows EXE 默认位于 `src-tauri/target/release/wagespack.exe`，需要 Rust MSVC 工具链、C++ Build Tools、Windows SDK 和 WebView2。Playwright 使用本机 Edge。

桌面右键可以打开设置、隐藏、退出。系统托盘可以找回桌宠。开机自启默认关闭。开发期间若开启自启，移动 EXE 后应重新关闭和开启。

## 角色导入

GitHub Releases 的 Windows 版内置原画小周、小祖。单独下载的源码使用开发占位图，供无素材环境测试。开发者本地可通过 `private-assets/` 加载有权使用的动作帧。

在「设置 → 角色管理器」选择 PNG 或 WebP。可以单独选择图集 PNG/WebP 和 JSON 清单。选择「预览导入」后保存。每次可保留一个自定义角色，另有两个内置角色。导入失败保留原角色。

图像最大 1,500,000 字节、单边 2048 像素、总计 2,097,152 像素。JSON 最大 32 KiB。使用统一帧尺寸和足底锚点，每个动作最多 48 帧，单帧 40–10,000 毫秒。坐标以图集左上为原点。清单不接受路径或 URL。

```json
{
  "name": "My pet",
  "author": "My name",
  "license": "Private",
  "width": 32,
  "height": 48,
  "anchor": [16, 46],
  "actions": {
    "idle": [{ "x": 0, "y": 0, "ms": 1000 }],
    "open": [{ "x": 32, "y": 0, "ms": 180 }]
  }
}
```

可选动作包括 `open`、`working` 和 `break`。缺少的动作使用 `idle`。

## 当前限制

- Windows 透明窗口的矩形范围仍命中鼠标。收起时窗口贴近角色画布。
- 内置角色是开发用原创像素占位素材。原始参考图及其发布许可独立管理。
- 新愿望按设定比例从创建时累计估算收入，并显示剩余净工作小时、预计天数及倒计时。预计完成时刻按当前计薪速率和已设置的排班、午休、休假投影。旧愿望保留原先的本月累计方式。
- 当前便携 EXE 为本地未签名测试构建。Windows 10、多显示器混合 DPI 和冷启动闪帧仍需完整验收。

[English](README.en.md) · [阶段计划](docs/plan.md) · [验证记录](docs/verification.md) · [隐私](PRIVACY.md)
