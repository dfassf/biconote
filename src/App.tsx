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
  const setFontSize = useCallback(
    (updater: number | ((prev: number) => number)) => {
      _setFontSize((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        localStorage.setItem("biconote_fontSize", String(next));
        return next;
      });
    },
    []
  );
  const { settings, saveSettings, isLoaded } = useSettings();
  const editor = useEditor(settings.noteDir);
  const lunch = useLunchMenu(settings);
  const {
    tabs,
    activeTab,
    activeTabId,
    setActiveTabId,
    openFile,
    openFileWithContent,
    updateContent,
    closeTab,
    reopenTab,
    newTab,
    renameTab,
  } = editor;
  const {
    status,
    error,
    todayMenu,
    cache,
    dayOffset,
    isWeekendDay,
    canGoPrev,
    canGoNext,
    refresh,
    navigateDay,
  } = lunch;

  // 테마 적용 (설정 로드 완료 후 + 변경 시)
  useEffect(() => {
    if (isLoaded) {
      document.documentElement.dataset.theme = settings.theme;
    }
  }, [settings.theme, isLoaded]);

  // 앱 시작 시 토큰이 있으면 자동 로드
  useEffect(() => {
    if (isLoaded && settings.slackToken) {
      void refresh();
    }
  }, [isLoaded, settings.slackToken, refresh]);

  // 날짜 변경 or 앱 재활성화 시 자동 새로고침
  const lastDateRef = useRef(getKSTDateString());
  const checkAndRefresh = useCallback(() => {
    const today = getKSTDateString();
    if (today !== lastDateRef.current) {
      lastDateRef.current = today;
      if (settings.slackToken) {
        void refresh();
      }
    }
  }, [settings.slackToken, refresh]);

  useEffect(() => {
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
  }, [checkAndRefresh]);

  const menuActionRef = useRef<(action: string) => void>(() => {});
  useEffect(() => {
    menuActionRef.current = (action: string) => {
      switch (action) {
        case "new_file":
          newTab();
          break;
        case "reopen_tab":
          reopenTab();
          break;
        case "open_file":
          void openFile();
          break;
        case "close_tab":
          closeTab(activeTabId);
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
    };
  }, [activeTabId, closeTab, newTab, openFile, reopenTab, setFontSize]);

  // 네이티브 메뉴 이벤트 수신
  useEffect(() => {
    let cleanup: (() => void) | null = null;
    let isDisposed = false;

    void listen<string>("menu-action", (event) => {
      menuActionRef.current(event.payload);
    })
      .then((unlisten) => {
        if (isDisposed) {
          unlisten();
          return;
        }
        cleanup = unlisten;
      })
      .catch((err) => {
        console.error("menu-action listen error:", err);
      });

    return () => {
      isDisposed = true;
      cleanup?.();
    };
  }, []);

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
          await openFileWithContent(fileName, text);
        }
      }
    },
    [openFileWithContent]
  );

  return (
    <div className="app" onDragOver={handleDragOver} onDrop={handleDrop}>
      <TitleBar
        onOpenFile={openFile}
        onOpenSettings={() => setShowSettings(true)}
      />
      <div className="main-content">
        <div className="editor-pane">
          <TabBar
            tabs={tabs}
            activeTabId={activeTabId}
            onSelectTab={setActiveTabId}
            onCloseTab={closeTab}
            onNewTab={newTab}
            onRenameTab={renameTab}
          />
          <EditorArea
            content={activeTab.content}
            onChange={updateContent}
            fileName={activeTab.fileName}
            fontSize={fontSize}
            tabId={activeTabId}
          />
        </div>
        <LunchPanel
          status={status}
          error={error}
          todayMenu={todayMenu}
          cache={cache}
          dayOffset={dayOffset}
          isWeekendDay={isWeekendDay}
          canGoPrev={canGoPrev}
          canGoNext={canGoNext}
          onRefresh={refresh}
          onNavigateDay={navigateDay}
        />
      </div>

      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={async (s) => {
            await saveSettings(s);
            setShowSettings(false);
            await refresh(s);
          }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default App;
