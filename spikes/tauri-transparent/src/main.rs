#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{AppHandle, Manager, PhysicalPosition};

#[tauri::command]
fn toggle_panel(app: AppHandle, close: bool) -> Result<(), String> {
    let panel = app.get_webview_window("panel").ok_or("Missing panel")?;
    let pet = app.get_webview_window("pet").ok_or("Missing pet")?;
    if close || panel.is_visible().map_err(|e| e.to_string())? {
        return panel.hide().map_err(|e| e.to_string());
    }

    let pet_pos = pet.outer_position().map_err(|e| e.to_string())?;
    let pet_size = pet.outer_size().map_err(|e| e.to_string())?;
    let panel_size = panel.outer_size().map_err(|e| e.to_string())?;
    if let Some(monitor) = pet.current_monitor().map_err(|e| e.to_string())? {
        let area = monitor.work_area();
        let right = pet_pos.x + pet_size.width as i32 + 8;
        let max_x = area.position.x + (area.size.width as i32 - panel_size.width as i32).max(0);
        let max_y = area.position.y + (area.size.height as i32 - panel_size.height as i32).max(0);
        let x = if right <= max_x { right } else { pet_pos.x - panel_size.width as i32 - 8 };
        panel.set_position(PhysicalPosition::new(
            x.clamp(area.position.x, max_x),
            pet_pos.y.clamp(area.position.y, max_y),
        )).map_err(|e| e.to_string())?;
    }
    panel.show().map_err(|e| e.to_string())?;
    panel.set_focus().map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![toggle_panel])
        .run(tauri::generate_context!())
        .expect("Unable to start the window spike");
}
