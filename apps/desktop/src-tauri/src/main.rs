// Sidcord masaüstü — web istemcisini Tauri (webkit2gtk / WebView2) penceresinde sarar.
// Dev: devUrl Vite (:3000). Prod: frontendDist + serverConfig.ts (sidcord_server_base).
// Masaüstü cilası: sistem tepsisi, kapatınca tepsiye küçülme, açılışta başlatma,
// pencere durumu hatırlama, harici linkler sistem tarayıcısında, global susturma
// kısayolu (Ctrl+Shift+M) ve oyun algılama → otomatik "Oynuyor" durumu.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashSet;
use std::time::Duration;

use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use tauri_plugin_global_shortcut::ShortcutState;

/// Bilinen oyunlar: (çalıştırılabilir adı, görünen ad). Adlar küçük harfle karşılaştırılır.
const GAMES: &[(&str, &str)] = &[
    ("valorant.exe", "VALORANT"),
    ("valorant-win64-shipping.exe", "VALORANT"),
    ("cs2.exe", "Counter-Strike 2"),
    ("cs2", "Counter-Strike 2"),
    ("csgo.exe", "CS:GO"),
    ("league of legends.exe", "League of Legends"),
    ("leagueclient.exe", "League of Legends"),
    ("gta5.exe", "Grand Theft Auto V"),
    ("fortniteclient-win64-shipping.exe", "Fortnite"),
    ("rocketleague.exe", "Rocket League"),
    ("dota2.exe", "Dota 2"),
    ("dota2", "Dota 2"),
    ("tslgame.exe", "PUBG: Battlegrounds"),
    ("eldenring.exe", "Elden Ring"),
    ("witcher3.exe", "The Witcher 3"),
    ("rdr2.exe", "Red Dead Redemption 2"),
    ("minecraft.exe", "Minecraft"),
    ("eurotrucks2.exe", "Euro Truck Simulator 2"),
    ("eurotrucks2", "Euro Truck Simulator 2"),
    ("stardewvalley.exe", "Stardew Valley"),
    ("terraria.exe", "Terraria"),
    ("amongus.exe", "Among Us"),
    ("wow.exe", "World of Warcraft"),
    ("overwatch.exe", "Overwatch 2"),
    ("r5apex.exe", "Apex Legends"),
    ("deadbydaylight-win64-shipping.exe", "Dead by Daylight"),
    ("fc24.exe", "EA SPORTS FC 24"),
    ("fc25.exe", "EA SPORTS FC 25"),
    ("hearthstone.exe", "Hearthstone"),
    ("metin2client.exe", "Metin2"),
    ("knightonline.exe", "Knight Online"),
    ("zula.exe", "Zula"),
    ("wolfteam.exe", "Wolfteam"),
];

/// Çalışan süreçleri periyodik tarar; bilinen bir oyun başlar/biterse web'e event yollar.
fn game_watcher(app: tauri::AppHandle) {
    let mut sys = sysinfo::System::new();
    let mut current: Option<&'static str> = None;
    loop {
        sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
        let mut running: HashSet<&'static str> = HashSet::new();
        for proc in sys.processes().values() {
            let name = proc.name().to_string_lossy().to_lowercase();
            for (exe, display) in GAMES {
                if name == *exe {
                    running.insert(display);
                }
            }
        }
        let detected = running.into_iter().next();
        if detected != current {
            match detected {
                Some(name) => {
                    eprintln!("[oyun-algilama] başladı: {name}");
                    let _ = app.emit("game-detected", name);
                }
                None => {
                    eprintln!("[oyun-algilama] kapandı");
                    let _ = app.emit("game-stopped", ());
                }
            }
            current = detected;
        }
        std::thread::sleep(Duration::from_secs(15));
    }
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        // Pencere odakta olmasa bile mikrofonu aç/kapa (web tarafı dinler)
                        let _ = app.emit("toggle-mute", ());
                    }
                })
                .build(),
        )
        .setup(|app| {
            // Sistem tepsisi: Göster · Açılışta Başlat (işaretli) · Çıkış
            let show = MenuItem::with_id(app, "show", "Sidcord'u Göster", true, None::<&str>)?;
            let autostart_enabled = app.autolaunch().is_enabled().unwrap_or(false);
            let autostart_item = CheckMenuItem::with_id(
                app,
                "autostart",
                "Açılışta Başlat",
                true,
                autostart_enabled,
                None::<&str>,
            )?;
            let quit = MenuItem::with_id(app, "quit", "Çıkış", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &autostart_item, &quit])?;

            let autostart_for_handler = autostart_item.clone();
            let _tray = TrayIconBuilder::with_id("sidcord-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Sidcord")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "show" => show_main_window(app),
                    "autostart" => {
                        let al = app.autolaunch();
                        let now_enabled = al.is_enabled().unwrap_or(false);
                        let _ = if now_enabled { al.disable() } else { al.enable() };
                        let _ = autostart_for_handler.set_checked(!now_enabled);
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                })
                .build(app)?;

            // Global susturma kısayolu — başka uygulama kapmışsa uygulamayı DÜŞÜRME, sadece logla
            {
                use tauri_plugin_global_shortcut::GlobalShortcutExt;
                if let Err(e) = app.global_shortcut().register("ctrl+shift+m") {
                    eprintln!("global kısayol (Ctrl+Shift+M) kaydedilemedi: {e}");
                }
            }

            // Oyun algılama (otomatik "Oynuyor" durumu)
            let handle = app.handle().clone();
            std::thread::spawn(move || game_watcher(handle));
            Ok(())
        })
        .on_window_event(|window, event| {
            // Kapat düğmesi = tepsiye küçült (Discord davranışı); gerçek çıkış tepsi menüsünden
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("Sidcord başlatılamadı");
}
