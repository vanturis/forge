//! Setting "Deckkraft": a window lets what lies behind it show through. Tauri has no call for it, so
//! the window gets it from the system: a layered window on Windows, the alpha value on macOS.
//! Linux keeps solid windows (the UI does not offer the setting there).

use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{Manager, Runtime, WebviewWindow, Window};

/// Opacity in percent per window label; windows that never asked are solid.
#[derive(Default)]
pub struct WindowOpacity(Mutex<HashMap<String, u8>>);

const MIN_PERCENT: u8 = 50;

/// Sets the opacity of the calling window (50 to 100 percent). Every window asks for itself, so chat
/// windows follow the setting as soon as they have loaded it.
#[tauri::command]
pub fn set_window_opacity<R: Runtime>(window: WebviewWindow<R>, state: tauri::State<WindowOpacity>, percent: u8) {
    let percent = percent.clamp(MIN_PERCENT, 100);
    if let Ok(mut map) = state.0.lock() {
        map.insert(window.label().to_owned(), percent);
    }
    apply(&window, percent);
}

/// tao writes the extended window style anew whenever a window flag changes (maximize, decorations,
/// always on top) and drops the layered bit with it: put the opacity back after such changes. Called
/// on resize and focus events and right after FORGE's own calls that change a flag (always on top).
pub fn reapply<R: Runtime>(window: &Window<R>) {
    #[cfg(windows)]
    {
        let percent = window.state::<WindowOpacity>().0.lock().ok().and_then(|m| m.get(window.label()).copied());
        if let (Some(percent), Ok(hwnd)) = (percent, window.hwnd()) {
            if percent < 100 {
                win::set(hwnd.0 as _, percent);
            }
        }
    }
    #[cfg(not(windows))]
    let _ = window;
}

pub fn forget<R: Runtime>(window: &Window<R>) {
    if let Ok(mut map) = window.state::<WindowOpacity>().0.lock() {
        map.remove(window.label());
    }
}

fn apply<R: Runtime>(window: &WebviewWindow<R>, percent: u8) {
    #[cfg(windows)]
    if let Ok(hwnd) = window.hwnd() {
        win::set(hwnd.0 as _, percent);
    }
    #[cfg(target_os = "macos")]
    {
        let win = window.clone();
        let _ = window.run_on_main_thread(move || {
            use objc2_app_kit::NSWindow;
            let Ok(ns) = win.ns_window() else { return };
            // SAFETY: Tauri hands out the NSWindow of this window; it lives as long as `win`, and this runs on the main thread.
            let ns = unsafe { &*(ns as *const NSWindow) };
            ns.setAlphaValue(f64::from(percent) / 100.0);
        });
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    let _ = (window, percent);
}

#[cfg(windows)]
mod win {
    use windows_sys::Win32::Foundation::HWND;
    use windows_sys::Win32::UI::WindowsAndMessaging::{GetWindowLongPtrW, SetLayeredWindowAttributes, SetWindowLongPtrW, GWL_EXSTYLE, LWA_ALPHA, WS_EX_LAYERED};

    /// A solid window is no layered window at all: nothing changes for those who leave the setting alone.
    pub fn set(hwnd: HWND, percent: u8) {
        // SAFETY: plain style calls on a window handle Tauri handed out; a handle that is gone makes them fail without effect.
        unsafe {
            let ex = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
            let layered = ex & WS_EX_LAYERED as isize != 0;
            if percent >= 100 {
                if layered {
                    SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex & !(WS_EX_LAYERED as isize));
                }
                return;
            }
            if !layered {
                SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex | WS_EX_LAYERED as isize);
            }
            SetLayeredWindowAttributes(hwnd, 0, (u32::from(percent) * 255 / 100) as u8, LWA_ALPHA);
        }
    }
}
