#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, PhysicalSize, WebviewWindow, WindowEvent};
use tauri_plugin_autostart::ManagerExt;

fn panel_origin(
    pet: PhysicalPosition<i32>,
    pet_width: i32,
    panel: (i32, i32),
    area: (i32, i32, i32, i32),
    gap: i32,
) -> PhysicalPosition<i32> {
    let (left, top, width, height) = area;
    let max_x = left + (width - panel.0).max(0);
    let max_y = top + (height - panel.1).max(0);
    let right = pet.x + pet_width + gap;
    let x = if right <= max_x { right } else { pet.x - panel.0 - gap };
    PhysicalPosition::new(x.clamp(left, max_x), pet.y.clamp(top, max_y))
}

fn place_panel(pet: &WebviewWindow, panel: &WebviewWindow) -> tauri::Result<()> {
    let pet_pos = pet.outer_position()?;
    let pet_size = pet.outer_size()?;
    let panel_size = panel.outer_size()?;
    if let Some(monitor) = pet.current_monitor()? {
        let area = monitor.work_area();
        let size = PhysicalSize::new(panel_size.width.min(area.size.width), panel_size.height.min(area.size.height));
        if size != panel_size {
            panel.set_size(size)?;
        }
        let gap = (8.0 * monitor.scale_factor()).round() as i32;
        panel.set_position(panel_origin(
            pet_pos,
            pet_size.width as i32,
            (size.width as i32, size.height as i32),
            (area.position.x, area.position.y, area.size.width as i32, area.size.height as i32),
            gap,
        ))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::panel_origin;
    use tauri::PhysicalPosition;

    #[test]
    fn prefers_right_and_switches_left_at_the_edge() {
        let area = (0, 0, 1000, 600);
        assert_eq!(panel_origin(PhysicalPosition::new(100, 60), 100, (300, 200), area, 8), PhysicalPosition::new(208, 60));
        assert_eq!(panel_origin(PhysicalPosition::new(850, 500), 100, (300, 200), area, 8), PhysicalPosition::new(542, 400));
    }

    #[test]
    fn handles_negative_monitor_coordinates() {
        let area = (-1600, -300, 1600, 900);
        assert_eq!(panel_origin(PhysicalPosition::new(-1100, -320), 174, (612, 840), area, 12), PhysicalPosition::new(-914, -300));
    }
}

fn set_panel(app: &AppHandle, close: bool, toggle: bool) -> tauri::Result<()> {
    let panel = app.get_webview_window("panel").ok_or_else(|| tauri::Error::WindowNotFound)?;
    let pet = app.get_webview_window("pet").ok_or_else(|| tauri::Error::WindowNotFound)?;
    if close || (toggle && panel.is_visible()?) {
        panel.hide()?;
        pet.emit("panel-visible", false)?;
        return Ok(());
    }
    place_panel(&pet, &panel)?;
    panel.show()?;
    pet.emit("panel-visible", true)?;
    panel.set_focus()
}

#[tauri::command]
fn toggle_panel(app: AppHandle, close: bool) -> Result<(), String> {
    set_panel(&app, close, true).map_err(|error| error.to_string())
}

#[tauri::command]
fn set_topmost(app: AppHandle, enabled: bool) -> Result<(), String> {
    for label in ["pet", "panel"] {
        let window = app.get_webview_window(label).ok_or("Missing window")?;
        window.set_always_on_top(enabled).map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn set_pet_size(app: AppHandle, scale: u32) -> Result<(), String> {
    let pet = app.get_webview_window("pet").ok_or("Missing pet")?;
    let factor = f64::from(scale.clamp(75, 150)) / 100.0;
    pet.set_size(LogicalSize::new(152.0 * factor, 218.0 * factor)).map_err(|error| error.to_string())?;
    restore_pet(&pet).map_err(|error| error.to_string())
}

#[tauri::command]
fn set_startup(app: AppHandle, enabled: bool) -> Result<(), String> {
    let startup = app.autolaunch();
    (if enabled { startup.enable() } else { startup.disable() }).map_err(|error| error.to_string())
}

#[tauri::command]
async fn open_pet_menu(app: AppHandle) -> Result<(), String> {
    let pet = app.get_webview_window("pet").ok_or("Missing pet")?;
    let result = (|| -> tauri::Result<()> {
        let settings = MenuItem::with_id(&app, "pet-settings", "设置与角色 / Settings & characters", true, None::<&str>)?;
        let hide = MenuItem::with_id(&app, "pet-hide", "隐藏 / Hide", true, None::<&str>)?;
        let exit = MenuItem::with_id(&app, "pet-exit", "退出 / Quit", true, None::<&str>)?;
        let menu = Menu::with_items(&app, &[&settings, &hide, &exit])?;
        pet.popup_menu(&menu)
    })();
    result.map_err(|error| error.to_string())
}

fn position_file(app: &AppHandle) -> Option<std::path::PathBuf> {
    Some(app.path().app_local_data_dir().ok()?.join("position.txt"))
}

fn restore_pet(pet: &WebviewWindow) -> tauri::Result<()> {
    let saved = position_file(pet.app_handle())
        .and_then(|path| std::fs::read_to_string(path).ok())
        .and_then(|text| {
            let (x, y) = text.split_once(',')?;
            Some(PhysicalPosition::new(x.parse::<i32>().ok()?, y.parse::<i32>().ok()?))
        });
    let monitors = pet.available_monitors()?;
    let on_monitor = saved.and_then(|point| monitors.iter().find(|monitor| {
        let area = monitor.work_area();
        point.x >= area.position.x && point.y >= area.position.y
            && i64::from(point.x) < i64::from(area.position.x) + i64::from(area.size.width)
            && i64::from(point.y) < i64::from(area.position.y) + i64::from(area.size.height)
    }));
    let primary = pet.primary_monitor()?;
    if let Some(monitor) = on_monitor.or(primary.as_ref()) {
        let area = monitor.work_area();
        let size = pet.outer_size()?;
        let max_x = area.position.x + (area.size.width as i32 - size.width as i32).max(0);
        let max_y = area.position.y + (area.size.height as i32 - size.height as i32).max(0);
        let point = if on_monitor.is_some() { saved.unwrap() } else { PhysicalPosition::new(max_x - 24, max_y - 24) };
        pet.set_position(PhysicalPosition::new(point.x.clamp(area.position.x, max_x), point.y.clamp(area.position.y, max_y)))?;
    }
    pet.show()
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .setup(|app| {
            let pet = app.get_webview_window("pet").expect("pet configuration");
            pet.on_menu_event(|window, event| {
                let app = window.app_handle();
                match event.id.as_ref() {
                    "pet-settings" => {
                        let _ = set_panel(app, false, false);
                        if let Some(panel) = app.get_webview_window("panel") { let _ = panel.emit("show-settings", ()); }
                    }
                    "pet-hide" => { let _ = set_panel(app, true, false); let _ = window.hide(); }
                    "pet-exit" => app.exit(0),
                    _ => {}
                }
            });
            restore_pet(&pet)?;
            let show = MenuItem::with_id(app, "show", "找回桌宠 / Show pet", true, None::<&str>)?;
            let info = MenuItem::with_id(app, "info", "信息与设置 / Dashboard", true, None::<&str>)?;
            let hide = MenuItem::with_id(app, "hide", "隐藏桌宠 / Hide pet", true, None::<&str>)?;
            let exit = MenuItem::with_id(app, "exit", "退出 / Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &info, &hide, &exit])?;
            let mut tray = TrayIconBuilder::new().menu(&menu).tooltip("wagespack").show_menu_on_left_click(true);
            if let Some(icon) = app.default_window_icon() { tray = tray.icon(icon.clone()); }
            tray.on_menu_event(|app, event| {
                let Some(pet) = app.get_webview_window("pet") else { return; };
                match event.id.as_ref() {
                    "show" => { let _ = restore_pet(&pet); }
                    "info" => { let _ = restore_pet(&pet); let _ = set_panel(app, false, false); }
                    "hide" => { let _ = set_panel(app, true, false); let _ = pet.hide(); }
                    "exit" => app.exit(0),
                    _ => {}
                }
            }).build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                if window.label() == "panel" { let _ = set_panel(window.app_handle(), true, false); }
                else { let _ = window.hide(); }
            }
            WindowEvent::Moved(point) if window.label() == "pet" => {
                if let Some(path) = position_file(window.app_handle()) {
                    if let Some(parent) = path.parent() {
                        let _ = std::fs::create_dir_all(parent);
                        let _ = std::fs::write(path, format!("{},{}", point.x, point.y));
                    }
                }
                if let (Some(pet), Some(panel)) = (
                    window.app_handle().get_webview_window("pet"),
                    window.app_handle().get_webview_window("panel"),
                ) {
                    if panel.is_visible().unwrap_or(false) { let _ = place_panel(&pet, &panel); }
                }
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![toggle_panel, set_topmost, set_pet_size, set_startup, open_pet_menu])
        .run(tauri::generate_context!())
        .expect("Unable to start wagespack");
}
