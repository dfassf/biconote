import { useState, useCallback, useEffect, useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import type { EditorTab } from "../types";
import {
  buildNotePath,
  initializeTabs,
  readExternalFile,
  readRelativeFile,
  removeRelativeFile,
  renameRelativeFile,
  writeNoteFile,
  writeRelativeFile,
} from "./editor/editorStorage";
import {
  AUTOSAVE_DELAY,
  EMPTY_TAB,
  INITIAL_TAB,
  MAX_CLOSED_TABS,
  createTabId,
  createUntitledTab,
  getNextUntitledNumber,
} from "./editor/tabUtils";
import { useTabAutosave } from "./editor/useTabAutosave";

export function useEditor(noteDir = "biconote") {
  const [tabs, setTabs] = useState<EditorTab[]>([INITIAL_TAB]);
  const [activeTabId, setActiveTabId] = useState<string>(INITIAL_TAB.id);
  const [isReady, setIsReady] = useState(false);
  const closedTabsRef = useRef<EditorTab[]>([]);
  const tabsRef = useRef<EditorTab[]>([INITIAL_TAB]);
  const activeTabIdRef = useRef(INITIAL_TAB.id);

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  const activeTab =
    tabs.find((t) => t.id === activeTabId) ??
    tabs[0] ??
    EMPTY_TAB;

  const autoSave = useCallback(
    async (tab: EditorTab) => {
      if (!tab.filePath || tab.content === tab.savedContent) return;
      try {
        await writeRelativeFile(tab.filePath, tab.content);
        setTabs((prev) =>
          prev.map((t) =>
            t.id === tab.id
              ? { ...t, savedContent: tab.content, isModified: false }
              : t
          )
        );
      } catch {
        // 저장 실패 시 무시
      }
    },
    []
  );

  const {
    scheduleSave: scheduleAutoSave,
    clearTimer: clearAutoSaveTimer,
    clearAllTimers: clearAllAutoSaveTimers,
  } = useTabAutosave(AUTOSAVE_DELAY, autoSave);

  // biconote 폴더 초기화 및 기존 파일 로드
  useEffect(() => {
    let cancelled = false;
    closedTabsRef.current = [];
    clearAllAutoSaveTimers();
    setIsReady(false);

    (async () => {
      try {
        const loadedTabs = await initializeTabs(noteDir);
        if (cancelled) return;
        setTabs(loadedTabs);
        setActiveTabId(loadedTabs[0].id);
      } catch (err) {
        // 초기화 실패 시 빈 탭으로 시작
        console.error("biconote init error:", err);
        const tab = createUntitledTab(1);
        if (cancelled) return;
        setTabs([tab]);
        setActiveTabId(tab.id);
      }
      if (cancelled) return;
      setIsReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [clearAllAutoSaveTimers, noteDir]);

  const upsertTab = useCallback(
    async (fileName: string, content: string) => {
      const relPath = await writeNoteFile(noteDir, fileName, content);

      setTabs((prev) => {
        const existing = prev.find((t) => t.fileName === fileName);
        if (existing) {
          setActiveTabId(existing.id);
          return prev.map((t) =>
            t.id === existing.id
              ? { ...t, content, savedContent: content, isModified: false }
              : t
          );
        }
        const tab: EditorTab = {
          id: createTabId(),
          filePath: relPath,
          fileName,
          content,
          savedContent: content,
          isModified: false,
        };
        setActiveTabId(tab.id);
        return [...prev, tab];
      });
    },
    [noteDir]
  );

  const openFile = useCallback(async () => {
    const filePath = await open({ multiple: false, directory: false });
    if (!filePath) return;

    const pathStr = Array.isArray(filePath) ? filePath[0] : filePath;
    if (!pathStr) return;
    const content = await readExternalFile(pathStr);
    const fileName = pathStr.split(/[/\\]/).pop() ?? "Unknown";
    await upsertTab(fileName, content);
  }, [upsertTab]);

  // 드래그앤드롭용: 파일명+내용으로 새 탭 열기
  const openFileWithContent = useCallback(
    async (fileName: string, content: string) => {
      await upsertTab(fileName, content);
    },
    [upsertTab]
  );

  const updateContent = useCallback(
    (content: string) => {
      setTabs((prev) => {
        const updated = prev.map((t) =>
          t.id === activeTabId
            ? { ...t, content, isModified: content !== t.savedContent }
            : t
        );
        const tab = updated.find((t) => t.id === activeTabId);
        if (tab) {
          scheduleAutoSave(tab);
        }
        return updated;
      });
    },
    [activeTabId, scheduleAutoSave]
  );

  const closeTab = useCallback(
    (tabId: string) => {
      clearAutoSaveTimer(tabId);

      setTabs((prev) => {
        const tab = prev.find((t) => t.id === tabId);
        if (tab) {
          const content = tab.isModified ? tab.content : tab.savedContent;
          const isEmpty = !content.trim();

          if (isEmpty && tab.filePath) {
            // 빈 파일은 디스크에서 삭제
            removeRelativeFile(tab.filePath).catch(() => {});
          } else {
            // 내용이 있는 탭만 복원 스택에 저장
            closedTabsRef.current = [
              tab,
              ...closedTabsRef.current.slice(0, MAX_CLOSED_TABS - 1),
            ];
            if (tab.isModified && tab.filePath) {
              writeRelativeFile(tab.filePath, tab.content).catch(() => {});
            }
          }
        }

        const remaining = prev.filter((t) => t.id !== tabId);
        if (remaining.length === 0) {
          const nextNum = getNextUntitledNumber(prev);
          const nt = createUntitledTab(nextNum);
          nt.filePath = buildNotePath(noteDir, nt.fileName);
          writeRelativeFile(nt.filePath, "").catch(() => {});
          remaining.push(nt);
        }
        if (activeTabIdRef.current === tabId) {
          setActiveTabId(remaining[remaining.length - 1].id);
        }
        return remaining;
      });
    },
    [clearAutoSaveTimer, noteDir]
  );

  const renameTab = useCallback(
    async (tabId: string, newName: string) => {
      const tab = tabsRef.current.find((t) => t.id === tabId);
      if (!tab || !newName.trim()) return;

      const trimmed = newName.trim();
      if (trimmed === tab.fileName) return;
      const oldPath = tab.filePath;
      const newPath = buildNotePath(noteDir, trimmed);

      try {
        if (oldPath) {
          await renameRelativeFile(oldPath, newPath);
        }
        setTabs((prev) =>
          prev.map((t) =>
            t.id === tabId
              ? { ...t, fileName: trimmed, filePath: newPath }
              : t
          )
        );
      } catch {
        // 이름 변경 실패
      }
    },
    [noteDir]
  );

  const reopenTab = useCallback(async () => {
    const closed = closedTabsRef.current.shift();
    if (!closed) return;

    // 파일이 아직 있으면 읽어오고, 없으면 캐싱된 내용 사용
    let content = closed.content;
    if (closed.filePath) {
      try {
        content = await readRelativeFile(closed.filePath);
      } catch {
        // 파일이 삭제된 경우 캐싱된 내용으로 복원 후 다시 저장
        await writeRelativeFile(closed.filePath, content).catch(() => {});
      }
    }

    const tab: EditorTab = {
      id: createTabId(),
      filePath: closed.filePath,
      fileName: closed.fileName,
      content,
      savedContent: content,
      isModified: false,
    };
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
  }, []);

  const newTab = useCallback(() => {
    setTabs((prev) => {
      const nextNum = getNextUntitledNumber(prev);
      const tab = createUntitledTab(nextNum);
      tab.filePath = buildNotePath(noteDir, tab.fileName);
      writeRelativeFile(tab.filePath, "").catch(() => {});
      setActiveTabId(tab.id);
      return [...prev, tab];
    });
  }, [noteDir]);

  return {
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
    isReady,
  };
}
