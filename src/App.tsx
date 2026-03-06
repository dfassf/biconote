import { useState, useEffect, useCallback, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { TitleBar } from "./components/titlebar/TitleBar";
import { TabBar } from "./components/editor/TabBar";
import { EditorArea } from "./components/editor/EditorArea";
import { LunchPanel } from "./components/sidebar/LunchPanel";
import { SettingsModal } from "./components/settings/SettingsModal";
import { useEditor } from "./hooks/useEditor";
import { useSettings } from "./hooks/useSettings";
import { useLunchMenu } from "./hooks/useLunchMenu";
import { getKSTDateString } from "./utils/dateUtils";

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [fontSize, _setFontSize] = useState(() => {
    const saved = localStorage.getItem("biconote_fontSize");
    return saved ? Number(saved) : 13;
  });
  const setFontSize = (updater: number | ((prev: number) => number)) => {
    _setFontSize((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      localStorage.setItem("biconote_fontSize", String(next));
      return next;
    });
  };
  const { settings, saveSettings, isLoaded } = useSettings();
  const editor = useEditor(settings.noteDir);
  const lunch = useLunchMenu(settings);

  // 테마 적용 (설정 로드 완료 후 + 변경 시)
  useEffect(() => {
    if (isLoaded) {
      document.documentElement.dataset.theme = settings.theme;
    }
  }, [settings.theme, isLoaded]);

  // 앱 시작 시 토큰이 있으면 자동 로드
  useEffect(() => {
    if (isLoaded && settings.slackToken) {
      lunch.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  // 날짜 변경 or 앱 재활성화 시 자동 새로고침
  const lastDateRef = useRef(getKSTDateString());
  useEffect(() => {
    const checkAndRefresh = () => {
      const today = getKSTDateString();
      if (today !== lastDateRef.current) {
        lastDateRef.current = today;
        if (settings.slackToken) {
          lunch.refresh();
        }
      }
    };

    // 앱이 다시 보일 때 (시스템 재시작, 창 전환 등)
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        checkAndRefresh();
      }
    };

    // 포커스 받을 때
    const onFocus = () => checkAndRefresh();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.slackToken]);

  // 네이티브 메뉴 이벤트 수신
  useEffect(() => {
    const unlisten = listen<string>("menu-action", (event) => {
      switch (event.payload) {
        case "new_file":
          editor.newTab();
          break;
        case "reopen_tab":
          editor.reopenTab();
          break;
        case "open_file":
          editor.openFile();
          break;
        case "close_tab":
          editor.closeTab(editor.activeTabId);
          break;
        case "zoom_in":
          setFontSize((s) => Math.min(s + 5, 50));
          break;
        case "zoom_out":
          setFontSize((s) => Math.max(s - 5, 8));
          break;
        case "zoom_reset":
          setFontSize(13);
          break;
        case "settings":
          setShowSettings(true);
          break;
      }
    });
    return () => { unlisten.then((f) => f()); };
  }, [editor]);

  // 드래그앤드롭
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Tauri의 파일 드롭 이벤트에서 경로 추출
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          // 브라우저 File API로 내용 읽기
          const text = await file.text();
          const fileName = file.name;

          // 에디터에서 openFilePath를 사용할 수 없으므로 직접 처리
          // openFilePath는 로컬 파일 시스템 경로가 필요한데, 브라우저 드래그앤드롭은 경로를 제공하지 않음
          // 대신 내용을 직접 읽어서 새 탭으로 추가
          editor.openFileWithContent(fileName, text);
        }
      }
    },
    [editor]
  );

  return (
    <div className="app" onDragOver={handleDragOver} onDrop={handleDrop}>
      <TitleBar
        onOpenFile={editor.openFile}
        onOpenSettings={() => setShowSettings(true)}
      />
      <div className="main-content">
        <div className="editor-pane">
          <TabBar
            tabs={editor.tabs}
            activeTabId={editor.activeTabId}
            onSelectTab={editor.setActiveTabId}
            onCloseTab={editor.closeTab}
            onNewTab={editor.newTab}
            onRenameTab={editor.renameTab}
          />
          <EditorArea
            content={editor.activeTab.content}
            onChange={editor.updateContent}
            fileName={editor.activeTab.fileName}
            fontSize={fontSize}
            tabId={editor.activeTabId}
          />
        </div>
        <LunchPanel
          status={lunch.status}
          error={lunch.error}
          todayMenu={lunch.todayMenu}
          cache={lunch.cache}
          dayOffset={lunch.dayOffset}
          isWeekendDay={lunch.isWeekendDay}
          canGoPrev={lunch.canGoPrev}
          canGoNext={lunch.canGoNext}
          onRefresh={lunch.refresh}
          onNavigateDay={lunch.navigateDay}
        />
      </div>

      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={async (s) => {
            await saveSettings(s);
            setShowSettings(false);
            lunch.refresh(s);
          }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default App;
