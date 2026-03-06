mod commands;

use tauri::{
    menu::{AboutMetadata, MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    Emitter,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // -- 앱 메뉴 (macOS 첫 번째 서브메뉴 = About 영역) --
            let app_submenu = SubmenuBuilder::new(app, "비코노트")
                .about(Some(AboutMetadata {
                    name: Some("비코노트".into()),
                    version: Some("1.0.0".into()),
                    ..Default::default()
                }))
                .separator()
                .services()
                .separator()
                .hide()
                .hide_others()
                .show_all()
                .separator()
                .quit()
                .build()?;

            // -- 파일 메뉴 --
            let new_file = MenuItemBuilder::new("새 파일")
                .id("new_file")
                .accelerator("CmdOrCtrl+N")
                .build(app)?;
            let new_tab = MenuItemBuilder::new("새 탭")
                .id("new_tab")
                .accelerator("CmdOrCtrl+T")
                .build(app)?;
            let reopen_tab = MenuItemBuilder::new("닫은 탭 열기")
                .id("reopen_tab")
                .accelerator("CmdOrCtrl+Shift+T")
                .build(app)?;
            let open_file = MenuItemBuilder::new("열기...")
                .id("open_file")
                .accelerator("CmdOrCtrl+O")
                .build(app)?;
            let close_tab = MenuItemBuilder::new("탭 닫기")
                .id("close_tab")
                .accelerator("CmdOrCtrl+W")
                .build(app)?;

            let file_submenu = SubmenuBuilder::new(app, "파일")
                .item(&new_file)
                .item(&new_tab)
                .item(&reopen_tab)
                .separator()
                .item(&open_file)
                .separator()
                .item(&close_tab)
                .build()?;

            // -- 편집 메뉴 --
            let edit_submenu = SubmenuBuilder::new(app, "편집")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .separator()
                .select_all()
                .build()?;

            // -- 보기 메뉴 --
            let zoom_in = MenuItemBuilder::new("글꼴 크게")
                .id("zoom_in")
                .accelerator("CmdOrCtrl+=")
                .build(app)?;
            let zoom_out = MenuItemBuilder::new("글꼴 작게")
                .id("zoom_out")
                .accelerator("CmdOrCtrl+-")
                .build(app)?;
            let zoom_reset = MenuItemBuilder::new("글꼴 원래 크기")
                .id("zoom_reset")
                .accelerator("CmdOrCtrl+0")
                .build(app)?;
            let settings = MenuItemBuilder::new("설정...")
                .id("settings")
                .accelerator("CmdOrCtrl+,")
                .build(app)?;

            let view_submenu = SubmenuBuilder::new(app, "보기")
                .item(&zoom_in)
                .item(&zoom_out)
                .item(&zoom_reset)
                .separator()
                .item(&settings)
                .build()?;

            // -- 윈도우 메뉴 --
            let window_submenu = SubmenuBuilder::new(app, "윈도우")
                .minimize()
                .maximize()
                .separator()
                .close_window()
                .build()?;

            let menu = MenuBuilder::new(app)
                .items(&[
                    &app_submenu,
                    &file_submenu,
                    &edit_submenu,
                    &view_submenu,
                    &window_submenu,
                ])
                .build()?;

            app.set_menu(menu)?;

            // 커스텀 메뉴 이벤트 → 프론트엔드로 전달
            let new_file_id = new_file.id().clone();
            let new_tab_id = new_tab.id().clone();
            let reopen_tab_id = reopen_tab.id().clone();
            let open_file_id = open_file.id().clone();
            let close_tab_id = close_tab.id().clone();
            let zoom_in_id = zoom_in.id().clone();
            let zoom_out_id = zoom_out.id().clone();
            let zoom_reset_id = zoom_reset.id().clone();
            let settings_id = settings.id().clone();

            app.on_menu_event(move |app, event| {
                let action = if event.id() == &new_file_id {
                    "new_file"
                } else if event.id() == &new_tab_id {
                    "new_file"
                } else if event.id() == &reopen_tab_id {
                    "reopen_tab"
                } else if event.id() == &open_file_id {
                    "open_file"
                } else if event.id() == &close_tab_id {
                    "close_tab"
                } else if event.id() == &zoom_in_id {
                    "zoom_in"
                } else if event.id() == &zoom_out_id {
                    "zoom_out"
                } else if event.id() == &zoom_reset_id {
                    "zoom_reset"
                } else if event.id() == &settings_id {
                    "settings"
                } else {
                    return;
                };
                let _ = app.emit("menu-action", action);
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::slack::fetch_lunch_images,
            commands::slack::check_lunch_message_ts,
            commands::gemini::analyze_menu_with_gemini,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
