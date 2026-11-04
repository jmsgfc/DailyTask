use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};
use tauri_plugin_sql::{Migration, MigrationKind};

const DB_URL: &str = "sqlite:dailytask.db";
const TRAY_SHOW_MAIN: &str = "tray:show-main";
const TRAY_SHOW_WIDGET: &str = "tray:show-widget";
const TRAY_PROGRESS: &str = "tray:progress";
const TRAY_QUIT: &str = "tray:quit";

/// 托盘里的「今日进度」菜单项，由前端在数据变化时更新文案。
struct TrayState {
    progress: MenuItem<tauri::Wry>,
}

#[tauri::command]
fn set_tray_progress(
    state: tauri::State<'_, TrayState>,
    text: String,
) -> Result<(), String> {
    state.progress.set_text(text).map_err(|error| error.to_string())
}

fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn show_widget(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("widget") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "init",
            sql: include_str!("../migrations/001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "checkin value",
            sql: include_str!("../migrations/002_checkin_value.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DB_URL, migrations)
                .build(),
        )
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let progress_item = MenuItem::with_id(
                app,
                TRAY_PROGRESS,
                "今日进度 —",
                false,
                None::<&str>,
            )?;
            let show_main_item =
                MenuItem::with_id(app, TRAY_SHOW_MAIN, "显示主窗口", true, None::<&str>)?;
            let show_widget_item =
                MenuItem::with_id(app, TRAY_SHOW_WIDGET, "显示挂件", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, TRAY_QUIT, "退出", true, None::<&str>)?;
            let separator_a = PredefinedMenuItem::separator(app)?;
            let separator_b = PredefinedMenuItem::separator(app)?;
            let menu = Menu::with_items(
                app,
                &[
                    &progress_item,
                    &separator_a,
                    &show_main_item,
                    &show_widget_item,
                    &separator_b,
                    &quit_item,
                ],
            )?;

            app.manage(TrayState {
                progress: progress_item,
            });

            if let Some(icon) = app.default_window_icon().cloned() {
                TrayIconBuilder::new()
                    .icon(icon)
                    .tooltip("DailyTask")
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app, event| match event.id().as_ref() {
                        TRAY_SHOW_MAIN => show_main(app),
                        TRAY_SHOW_WIDGET => show_widget(app),
                        TRAY_QUIT => app.exit(0),
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event
                        {
                            show_widget(tray.app_handle());
                        }
                    })
                    .build(app)?;
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![set_tray_progress])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
