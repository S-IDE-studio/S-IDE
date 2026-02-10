fn main() {
    #[cfg(target_os = "windows")]
    {
        // Hide console window on Windows in release builds
        if cfg!(not(debug_assertions)) {
            println!("cargo:rustc-link-arg=/SUBSYSTEM:WINDOWS");
            println!("cargo:rustc-link-arg=/ENTRY:mainCRTStartup");
        }
    }
    
    tauri_build::build();
}
