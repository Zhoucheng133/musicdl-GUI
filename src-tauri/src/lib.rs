use std::path::Path;
use futures_util::StreamExt;
use tauri::AppHandle;
use tokio::select;
use std::sync::{Arc, Mutex};
use tokio::sync::watch;
use tauri::Emitter;

#[derive(Clone)]
struct AppState {
    cancel_tx: Arc<Mutex<Option<watch::Sender<bool>>>>,
}

#[tauri::command]
fn path_check(path: &str) -> bool {
    return Path::new(&path).exists();
}

#[tauri::command]
fn cancel_download(state: tauri::State<AppState>) -> Result<(), String> {
    let guard = state.cancel_tx.lock().unwrap();

    if let Some(tx) = &*guard {
        let _ = tx.send(true);
        Ok(())
    } else {
        Err("当前没有下载任务".into())
    }
}

#[tauri::command]
async fn download_file(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    url: &str,
    save_path: &str
) -> Result<(), String> {
    let (tx, mut rx) = watch::channel(false);
    {
        let mut guard = state.cancel_tx.lock().unwrap();
        *guard = Some(tx);
    }

    let response = reqwest::get(url).await.map_err(|e| e.to_string())?;
    let total_size = response.content_length().unwrap_or(0);

    let mut file = std::fs::File::create(&save_path)
        .map_err(|e| e.to_string())?;

    let mut stream = response.bytes_stream();
    let mut downloaded = 0;

    while let Some(item) = stream.next().await {
        select! {
            _ = rx.changed() => {
                if *rx.borrow() {
                    println!("下载被取消");

                    // 可选：删除未完成文件
                    let _ = std::fs::remove_file(&save_path);

                    return Err("已取消".into());
                }
            }

            chunk = async { item } => {
                let chunk = chunk.map_err(|e| e.to_string())?;

                use std::io::Write;
                file.write_all(&chunk).map_err(|e| e.to_string())?;

                downloaded += chunk.len() as u64;

                let progress = if total_size > 0 {
                    downloaded as f64 / total_size as f64
                } else {
                    0.0
                };

                app.emit("download-progress", progress).ok();
            }
        }
    }

    // 清空状态
    {
        let mut guard = state.cancel_tx.lock().unwrap();
        *guard = None;
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            cancel_tx: Arc::new(Mutex::new(None)),
        })
        .invoke_handler(tauri::generate_handler![path_check, download_file, cancel_download])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
