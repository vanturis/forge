//! Setting "Transparenz": the desktop shows blurred through the background of the window (Windows
//! acrylic), while text and controls stay solid. The windows are created transparent on Windows
//! (tauri.windows.conf.json); whether anything shows through is up to the page, which paints its
//! backdrop solid or translucent. This module switches the blur behind it on and off.
//!
//! Only on Windows 11 22H2 and newer: before that, acrylic makes moving and resizing a window lag.
//! There, and on macOS and Linux, windows are solid.

use tauri::{Runtime, WebviewWindow};

#[cfg(windows)]
fn supported() -> bool {
    windows_version::OsVersion::current().build >= 22621
}

#[cfg(not(windows))]
fn supported() -> bool {
    false
}

/// Whether this system can show the blurred backdrop; the UI offers the setting only then.
#[tauri::command]
pub fn transparency_supported() -> bool {
    supported()
}

/// Switches the blur behind the calling window on or off. Every window asks for itself once it has
/// the settings.
#[tauri::command]
pub fn set_window_transparency<R: Runtime>(window: WebviewWindow<R>, on: bool) {
    if supported() {
        blur(&window, on);
    }
}

/// A new window is transparent before its page has painted anything. With the blur it shows a dark
/// material from the first frame (the page clears it again if the setting is off); where the system
/// cannot blur, the window gets a solid background instead and stays that way.
pub fn prepare<R: Runtime>(window: &WebviewWindow<R>) {
    if supported() {
        blur(window, true);
    } else {
        #[cfg(windows)]
        let _ = window.set_background_color(Some(tauri::window::Color(11, 11, 12, 255)));
    }
}

fn blur<R: Runtime>(window: &WebviewWindow<R>, on: bool) {
    #[cfg(windows)]
    {
        use tauri::window::{Effect, EffectsBuilder};
        let _ = window.set_effects(on.then(|| EffectsBuilder::new().effect(Effect::Acrylic).build()));
    }
    #[cfg(not(windows))]
    let _ = (window, on);
}
