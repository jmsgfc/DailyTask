mod widget_visibility;

use std::sync::Mutex;

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};
use tauri_plugin_sql::{Migration, MigrationKind};

const DB_URL: &str = "sqlite:dailytask.db";
const WIDGET_LABEL: &str = "widget";
const WIDGET_VISIBILITY_FILE: &str = "widget-visible";
const TRAY_TOGGLE_MAIN: &str = "tray:toggle-main";
const TRAY_TOGGLE_WIDGET: &str = "tray:toggle-widget";
const TRAY_PROGRESS: &str = "tray:progress";
const TRAY_QUIT: &str = "tray:quit";

#[derive(Clone)]
struct TrayLabels {
    show_main: String,
    hide_main: String,
    show_widget: String,
    hide_widget: String,
    quit: String,
}

impl Default for TrayLabels {
    fn default() -> Self {
        Self {
            show_main: "显示主窗口".to_string(),
            hide_main: "隐藏主窗口".to_string(),
            show_widget: "显示挂件".to_string(),
            hide_widget: "隐藏挂件".to_string(),
            quit: "退出".to_string(),
        }
    }
}

/// 托盘菜单项与当前语言文案；文案由前端在语言变化时下发。
struct TrayState {
    progress: MenuItem<tauri::Wry>,
    main_item: MenuItem<tauri::Wry>,
    widget_item: MenuItem<tauri::Wry>,
    quit_item: MenuItem<tauri::Wry>,
    labels: Mutex<TrayLabels>,
}

#[tauri::command]
fn set_tray_progress(
    state: tauri::State<'_, TrayState>,
    text: String,
) -> Result<(), String> {
    state.progress.set_text(text).map_err(|error| error.to_string())
}

#[tauri::command]
fn set_tray_labels(
    app: AppHandle,
    state: tauri::State<'_, TrayState>,
    show_main: String,
    hide_main: String,
    show_widget: String,
    hide_widget: String,
    quit: String,
) -> Result<(), String> {
    {
        let mut labels = state
            .labels
            .lock()
            .map_err(|_| "tray labels lock poisoned".to_string())?;
        *labels = TrayLabels {
            show_main,
            hide_main,
            show_widget,
            hide_widget,
            quit,
        };
    }
    sync_tray_labels(&app);
    Ok(())
}

fn is_visible(app: &AppHandle, label: &str) -> bool {
    app.get_webview_window(label)
        .and_then(|window| window.is_visible().ok())
        .unwrap_or(false)
}

/// 托盘菜单复用同一项：可见时显示「隐藏」，不可见时显示「显示」。
fn sync_tray_labels(app: &AppHandle) {
    let Some(state) = app.try_state::<TrayState>() else {
        return;
    };
    let labels = state
        .labels
        .lock()
        .map(|labels| labels.clone())
        .unwrap_or_default();
    let _ = state.main_item.set_text(if is_visible(app, "main") {
        labels.hide_main.as_str()
    } else {
        labels.show_main.as_str()
    });
    let _ = state.widget_item.set_text(if is_visible(app, "widget") {
        labels.hide_widget.as_str()
    } else {
        labels.show_widget.as_str()
    });
    let _ = state.quit_item.set_text(labels.quit.as_str());
}

fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
    sync_tray_labels(app);
}

fn widget_visibility_path(app: &AppHandle) -> Option<std::path::PathBuf> {
    app.path()
        .app_data_dir()
        .ok()
        .map(|dir| dir.join(WIDGET_VISIBILITY_FILE))
}

/// 标记文件读不到时按可见处理，和 `widget_visibility::read_visibility` 保持一致。
fn widget_starts_visible(app: &AppHandle) -> bool {
    widget_visibility_path(app)
        .map(|path| widget_visibility::read_visibility(&path))
        .unwrap_or(true)
}

fn persist_widget_visibility(app: &AppHandle, visible: bool) {
    let Some(path) = widget_visibility_path(app) else {
        return;
    };
    if let Err(error) = widget_visibility::write_visibility(&path, visible) {
        eprintln!("[widget] 保存可见性失败: {error}");
    }
}

/// 挂件配置仍在 `tauri.conf.json`，只是 `create: false`；销毁后按同一份配置重建。
/// 这样 transparent / skipTaskbar 等参数只维护一处。
fn ensure_widget(app: &AppHandle) -> Result<(), String> {
    if app.get_webview_window(WIDGET_LABEL).is_some() {
        return Ok(());
    }
    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|window| window.label == WIDGET_LABEL)
        .cloned()
        .ok_or_else(|| "tauri.conf.json 缺少 widget 窗口配置".to_string())?;
    tauri::WebviewWindowBuilder::from_config(app, &config)
        .map_err(|error| error.to_string())?
        .build()
        .map(|_| ())
        .map_err(|error| error.to_string())
}

fn show_widget(app: &AppHandle) {
    if let Err(error) = ensure_widget(app) {
        eprintln!("[widget] 创建挂件失败: {error}");
        return;
    }
    if let Some(window) = app.get_webview_window(WIDGET_LABEL) {
        let _ = window.show();
        let _ = window.set_focus();
    }
    persist_widget_visibility(app, true);
    sync_tray_labels(app);
}

/// 托盘左键：同时唤回主窗与挂件，最后聚焦主窗。
fn show_both(app: &AppHandle) {
    show_widget(app);
    show_main(app);
}

fn toggle_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if is_visible(app, "main") {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
    }
    sync_tray_labels(app);
}

fn toggle_widget(app: &AppHandle) {
    if is_visible(app, WIDGET_LABEL) {
        if let Some(window) = app.get_webview_window(WIDGET_LABEL) {
            let _ = window.destroy();
        }
        persist_widget_visibility(app, false);
    } else {
        show_widget(app);
    }
    sync_tray_labels(app);
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
        Migration {
            version: 3,
            description: "task interval every days",
            sql: include_str!("../migrations/003_task_interval_every_days.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "drop recorded status",
            sql: include_str!("../migrations/004_drop_recorded_status.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        // 必须最先注册：第二个实例在这里直接退出并把主窗唤回。
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main(app);
        }))
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
            let show_main_item = MenuItem::with_id(
                app,
                TRAY_TOGGLE_MAIN,
                "隐藏主窗口",
                true,
                None::<&str>,
            )?;
            let show_widget_item = MenuItem::with_id(
                app,
                TRAY_TOGGLE_WIDGET,
                "隐藏挂件",
                true,
                None::<&str>,
            )?;
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
                main_item: show_main_item,
                widget_item: show_widget_item,
                quit_item,
                labels: Mutex::new(TrayLabels::default()),
            });

            if let Some(icon) = app.default_window_icon().cloned() {
                // dev 配置把 productName 改成 “DailyTask Dev”，托盘提示也随之区分。
                let product = app
                    .config()
                    .product_name
                    .clone()
                    .unwrap_or_else(|| "DailyTask".to_string());
                TrayIconBuilder::new()
                    .icon(icon)
                    .tooltip(&product)
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app, event| match event.id().as_ref() {
                        TRAY_TOGGLE_MAIN => toggle_main(app),
                        TRAY_TOGGLE_WIDGET => toggle_widget(app),
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
                            show_both(tray.app_handle());
                        }
                    })
                    .build(app)?;
            }

            // 仅在 debug 构建自动打开 DevTools，方便排查前端初始化与 IPC 问题。
            #[cfg(debug_assertions)]
            if let Some(window) = app.get_webview_window("main") {
                window.open_devtools();
            }

            // 挂件不在 conf 里自动创建：上次隐藏过就等到托盘再重建。
            if widget_starts_visible(app.handle()) {
                if let Err(error) = ensure_widget(app.handle()) {
                    eprintln!("[widget] 启动时创建挂件失败: {error}");
                }
            }
            sync_tray_labels(app.handle());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            set_tray_progress,
            set_tray_labels
        ])
        // 主窗关闭 = 隐藏到托盘（impl.md §5），单实例回调才能把它再唤回来。
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::Focused(true)) {
                sync_tray_labels(window.app_handle());
            }
            if window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                    sync_tray_labels(window.app_handle());
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
