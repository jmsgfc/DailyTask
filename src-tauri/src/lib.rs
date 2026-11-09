mod widget_visibility;

use std::sync::Mutex;

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Listener, Manager, PhysicalPosition, PhysicalSize,
};
use tauri_plugin_sql::{Migration, MigrationKind};

const DB_URL: &str = "sqlite:dailytask.db";
const MAIN_LABEL: &str = "main";
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

/// 主窗销毁前的几何；只存在进程内存，应用退出后回到 conf 默认值。
#[derive(Clone, Copy)]
struct MainGeometry {
    position: PhysicalPosition<i32>,
    /// 与 `set_size` 配对的是 inner size；用 outer size 会每轮把边框再加一遍。
    inner_size: Option<PhysicalSize<u32>>,
    maximized: bool,
}

struct MainState {
    geometry: Mutex<Option<MainGeometry>>,
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
    let _ = state.main_item.set_text(if is_visible(app, MAIN_LABEL) {
        labels.hide_main.as_str()
    } else {
        labels.show_main.as_str()
    });
    let _ = state.widget_item.set_text(if is_visible(app, WIDGET_LABEL) {
        labels.hide_widget.as_str()
    } else {
        labels.show_widget.as_str()
    });
    let _ = state.quit_item.set_text(labels.quit.as_str());
}

/// 窗口配置仍在 `tauri.conf.json`；销毁后按同一份配置重建，
/// 这样 transparent / skipTaskbar / 尺寸等参数只维护一处。
fn ensure_window(app: &AppHandle, label: &str) -> Result<(), String> {
    if app.get_webview_window(label).is_some() {
        return Ok(());
    }
    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|window| window.label == label)
        .cloned()
        .ok_or_else(|| format!("tauri.conf.json 缺少 {label} 窗口配置"))?;
    tauri::WebviewWindowBuilder::from_config(app, &config)
        .map_err(|error| error.to_string())?
        .build()
        .map(|_| ())
        .map_err(|error| error.to_string())
}

fn remember_main(app: &AppHandle) {
    let Some(window) = app.get_webview_window(MAIN_LABEL) else {
        return;
    };
    let Ok(position) = window.outer_position() else {
        return;
    };
    let maximized = window.is_maximized().unwrap_or(false);
    // 最大化时 inner_size 是最大化后的内容区，还原时会以它为尺寸，所以只保留上次普通尺寸。
    let inner_size = if maximized {
        None
    } else {
        window.inner_size().ok()
    };
    let Some(state) = app.try_state::<MainState>() else {
        return;
    };
    let Ok(mut geometry) = state.geometry.lock() else {
        return;
    };
    let previous = *geometry;
    *geometry = Some(MainGeometry {
        position,
        inner_size: inner_size.or(previous.and_then(|geometry| geometry.inner_size)),
        maximized,
    });
}

fn restore_main(app: &AppHandle, window: &tauri::WebviewWindow) {
    let Some(state) = app.try_state::<MainState>() else {
        return;
    };
    let Ok(geometry) = state.geometry.lock() else {
        return;
    };
    let Some(geometry) = *geometry else {
        return;
    };
    if let Some(inner_size) = geometry.inner_size {
        let _ = window.set_size(inner_size);
    }
    let _ = window.set_position(geometry.position);
    if geometry.maximized {
        let _ = window.maximize();
    }
}

fn hide_main(app: &AppHandle) {
    remember_main(app);
    if let Some(window) = app.get_webview_window(MAIN_LABEL) {
        let _ = window.destroy();
    }
    sync_tray_labels(app);
}

fn show_main(app: &AppHandle) {
    if let Err(error) = ensure_window(app, MAIN_LABEL) {
        eprintln!("[window] 创建主窗口失败: {error}");
        return;
    }
    if let Some(window) = app.get_webview_window(MAIN_LABEL) {
        restore_main(app, &window);
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
fn show_widget(app: &AppHandle) {
    if let Err(error) = ensure_window(app, WIDGET_LABEL) {
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
    if is_visible(app, MAIN_LABEL) {
        hide_main(app);
    } else {
        show_main(app);
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
            app.manage(MainState {
                geometry: Mutex::new(None),
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

            // 挂件「展开主窗口」：主窗可能已被销毁，必须由 Rust 负责重建。
            let handle = app.handle().clone();
            app.listen("widget:expand", move |_event| {
                show_main(&handle);
            });

            // 仅在 debug 构建自动打开 DevTools，方便排查前端初始化与 IPC 问题。
            #[cfg(debug_assertions)]
            if let Some(window) = app.get_webview_window(MAIN_LABEL) {
                window.open_devtools();
            }

            // 挂件不在 conf 里自动创建：上次隐藏过就等到托盘再重建。
            if widget_starts_visible(app.handle()) {
                if let Err(error) = ensure_window(app.handle(), WIDGET_LABEL) {
                    eprintln!("[widget] 启动时创建挂件失败: {error}");
                }
            }
            // conf 把主窗设为 visible:false，启动与唤回统一走 show_main。
            show_main(app.handle());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            set_tray_progress,
            set_tray_labels
        ])
        // 主窗关闭 = 销毁窗口收进托盘；单实例/托盘/挂件唤回时重建。
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::Focused(true)) {
                sync_tray_labels(window.app_handle());
            }
            // destroy() 是异步的：销毁当刻 is_visible 仍为 true，必须等 Destroyed 再同步文案。
            if (window.label() == MAIN_LABEL || window.label() == WIDGET_LABEL)
                && matches!(event, tauri::WindowEvent::Destroyed)
            {
                sync_tray_labels(window.app_handle());
            }
            if window.label() == MAIN_LABEL {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    hide_main(window.app_handle());
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, event| {
            // 主窗和挂件都可能被销毁；没有窗口时 Tauri 会请求退出，托盘还必须活着。
            // 托盘「退出」走 app.exit(0)，code 是 Some，不拦截。
            if let tauri::RunEvent::ExitRequested { code: None, api, .. } = event {
                api.prevent_exit();
            }
        });
}
