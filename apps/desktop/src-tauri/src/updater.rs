use tauri::{AppHandle, Emitter};
use tauri_plugin_updater::UpdaterExt;

#[derive(Clone, serde::Serialize)]
pub struct UpdateInfo {
    pub current_version: String,
    pub latest_version: String,
    pub body: String,
    pub date: String,
}

pub async fn check_for_updates(app: &AppHandle) -> Result<Option<UpdateInfo>, String> {
    let updater = app.updater().map_err(|e| format!("Updater error: {}", e))?;

    match updater.check().await {
        Ok(Some(update)) => {
            let date_str = update.date
                .map(|d| d.to_string())
                .unwrap_or_else(|| "Unknown".to_string());
            Ok(Some(UpdateInfo {
                current_version: env!("CARGO_PKG_VERSION").to_string(),
                latest_version: update.version.clone(),
                body: update.body.clone().unwrap_or_default(),
                date: date_str,
            }))
        }
        Ok(None) => Ok(None),
        Err(e) => Err(format!("Update check failed: {}", e)),
    }
}

pub async fn download_and_install(app: &AppHandle) -> Result<(), String> {
    let updater = app.updater().map_err(|e| format!("Updater error: {}", e))?;

    // Check for update first
    let update = updater
        .check()
        .await
        .map_err(|e| format!("Check failed: {}", e))?
        .ok_or("No update available")?;

    // Download and install with progress events
    update
        .download_and_install(
            move |chunk_length, content_length| {
                let progress = if let Some(total) = content_length {
                    (chunk_length as f32 / total as f32) * 100.0
                } else {
                    0.0
                };
                let _ = app.emit("update-progress", progress);
            },
            || {
                let _ = app.emit("update-complete", ());
            },
        )
        .await
        .map_err(|e| format!("Download failed: {}", e))?;

    Ok(())
}
