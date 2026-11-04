use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};
use tauri_plugin_sql::{Migration, MigrationKind};

const DB_URL: &str = "sqlite:dailytask.db";
const TRAY_SHOW_MAIN: &str = "tray:show-main";
const TRAY_SHOW_WIDGET: &str = "tray:show-widget";
const TRAY_QUIT: &str = "tray:quit";

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
        .setup(|app| {
            let show_main_item =
                MenuItem::with_id(app, TRAY_SHOW_MAIN, "显示主窗口", true, None::<&str>)?;
            let show_widget_item =
                MenuItem::with_id(app, TRAY_SHOW_WIDGET, "显示挂件", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, TRAY_QUIT, "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_main_item, &show_widget_item, &quit_item])?;

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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
