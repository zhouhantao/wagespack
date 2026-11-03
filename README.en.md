# wagespack

wagespack is a local-first pixel desktop pet for Windows and the web. Click the pet to open the earnings estimate, countdown, work progress, and wish list. Click the close button or press Escape to collapse the dashboard. The Windows app supports dragging and tray recovery.

Run `npm ci`, then `npm run dev` for the web app. Run `npm test`, `npm run e2e`, and `npm run build` to verify it. With the Rust MSVC toolchain, C++ Build Tools, and Windows SDK installed, run `cargo build --locked --release --manifest-path src-tauri/Cargo.toml`. The local Windows executable requires WebView2. Browser tests use Microsoft Edge.

The compact transparent window still intercepts pointer input within its bounds. Earnings are estimates. This is an unsigned development build. See the [Chinese README](README.md) for the character format and current limits.
