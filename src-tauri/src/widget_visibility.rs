use std::path::Path;

const VISIBLE: &str = "1";
const HIDDEN: &str = "0";

/// 解析持久化标记；`0` 以外一律按可见处理，保证旧版本与损坏文件不影响启动。
pub fn parse_visibility(raw: &str) -> bool {
    raw.trim() != HIDDEN
}

pub fn encode_visibility(visible: bool) -> &'static str {
    if visible {
        VISIBLE
    } else {
        HIDDEN
    }
}

/// 文件不存在或不可读时按可见处理，首次启动仍显示挂件。
pub fn read_visibility(path: &Path) -> bool {
    std::fs::read_to_string(path)
        .map(|raw| parse_visibility(&raw))
        .unwrap_or(true)
}

pub fn write_visibility(path: &Path, visible: bool) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, encode_visibility(visible))
}

#[cfg(test)]
fn temp_dir(name: &str) -> std::path::PathBuf {
    let mut path = std::env::temp_dir();
    path.push(format!(
        "dailytask-visibility-{}-{}",
        std::process::id(),
        name
    ));
    path
}

#[test]
fn defaults_to_visible_when_marker_missing() {
    let dir = temp_dir("missing");
    let _ = std::fs::remove_dir_all(&dir);

    assert!(read_visibility(&dir.join("widget-visible")));
}

#[test]
fn parses_known_markers() {
    assert!(parse_visibility("1"));
    assert!(!parse_visibility("0"));
}

#[test]
fn falls_back_to_visible_for_blank_or_unknown_markers() {
    assert!(parse_visibility(""));
    assert!(parse_visibility(" \n"));
    assert!(parse_visibility("true"));
    assert!(parse_visibility("garbage"));
}

#[test]
fn tolerates_surrounding_whitespace() {
    assert!(!parse_visibility(" 0 \n"));
    assert!(parse_visibility(" 1 "));
}

#[test]
fn encodes_visibility_as_single_character() {
    assert_eq!(encode_visibility(true), "1");
    assert_eq!(encode_visibility(false), "0");
}

#[test]
fn writes_and_reads_back_hidden_state() {
    let dir = temp_dir("roundtrip");
    let path = dir.join("widget-visible");

    write_visibility(&path, false).expect("write marker");

    assert!(!read_visibility(&path));

    write_visibility(&path, true).expect("overwrite marker");
    assert!(read_visibility(&path));

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn creates_missing_parent_directory() {
    let dir = temp_dir("nested");
    let path = dir.join("nested/widget-visible");
    let _ = std::fs::remove_dir_all(&dir);

    write_visibility(&path, false).expect("create parent");

    assert!(!read_visibility(&path));

    let _ = std::fs::remove_dir_all(&dir);
}
