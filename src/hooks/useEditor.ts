import { useState, useCallback, useEffect, useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  readTextFile,
  writeTextFile,
  readDir,
  mkdir,
  exists,
  rename,
  remove,
  BaseDirectory,
} from "@tauri-apps/plugin-fs";
import type { EditorTab } from "../types";

const AUTOSAVE_DELAY = 1000;
const BASE = BaseDirectory.Document;
const MAX_CLOSED_TABS = 20;

function genId(): string {
  return Math.random().toString(36).substring(2, 10);
}

function newUntitledTab(num: number): EditorTab {
  const fileName = `note-${num}.txt`;
  return {
    id: genId(),
    filePath: null,
    fileName,
    content: "",
    savedContent: "",
    isModified: false,
  };
}

const INITIAL_TAB = newUntitledTab(1);

const EMPTY_TAB: EditorTab = {
  id: "",
  filePath: null,
  fileName: "Untitled",
  content: "",
  savedContent: "",
  isModified: false,
};

function getNextUntitledNumber(tabs: EditorTab[]): number {
  return (
    Math.max(
      0,
      ...tabs.map((t) => {
        const m = t.fileName.match(/^note-(\d+)\.txt$/);
        return m ? parseInt(m[1], 10) : 0;
      })
    ) + 1
  );
}

export function useEditor(noteDir = "biconote") {
  const notePath = (fileName: string) => `${noteDir}/${fileName}`;
  const [tabs, setTabs] = useState<EditorTab[]>([INITIAL_TAB]);
  const [activeTabId, setActiveTabId] = useState<string>(INITIAL_TAB.id);
  const [isReady, setIsReady] = useState(false);
  const saveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );
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

  const clearSaveTimer = useCallback((tabId: string) => {
    const timer = saveTimersRef.current.get(tabId);
    if (!timer) return;
    clearTimeout(timer);
    saveTimersRef.current.delete(tabId);
  }, []);

  const autoSave = useCallback(
    async (tab: EditorTab) => {
      if (!tab.filePath || tab.content === tab.savedContent) return;
      try {
        await writeTextFile(tab.filePath, tab.content, { baseDir: BASE });
        setTabs((prev) =>
          prev.map((t) =>
            t.id === tab.id
              ? { ...t, savedContent: tab.content, isModified: false }
              : t
          )
        );
      } catch {
        // 저장 실패 시 무시
      } finally {
        clearSaveTimer(tab.id);
      }
    },
    [clearSaveTimer]
  );

  const scheduleAutoSave = useCallback(
    (tab: EditorTab) => {
      clearSaveTimer(tab.id);
      const timer = setTimeout(() => {
        void autoSave(tab);
      }, AUTOSAVE_DELAY);
      saveTimersRef.current.set(tab.id, timer);
    },
    [autoSave, clearSaveTimer]
  );

  useEffect(() => {
    return () => {
      saveTimersRef.current.forEach((timer) => clearTimeout(timer));
      saveTimersRef.current.clear();
    };
  }, []);

  // biconote 폴더 초기화 및 기존 파일 로드
  useEffect(() => {
    let cancelled = false;
    closedTabsRef.current = [];
    saveTimersRef.current.forEach((timer) => clearTimeout(timer));
    saveTimersRef.current.clear();
    setIsReady(false);

    (async () => {
      try {
        const dirExists = await exists(noteDir, { baseDir: BASE });
        if (!dirExists) {
          await mkdir(noteDir, { baseDir: BASE, recursive: true });
        }

        const entries = await readDir(noteDir, { baseDir: BASE });
        const loadedTabs: EditorTab[] = [];

        for (const entry of entries) {
          if (entry.isFile && entry.name) {
            const relPath = notePath(entry.name);
            try {
              const content = await readTextFile(relPath, { baseDir: BASE });
              loadedTabs.push({
                id: genId(),
                filePath: relPath,
                fileName: entry.name,
                content,
                savedContent: content,
                isModified: false,
              });
            } catch {
              // 읽기 실패 시 무시
            }
          }
        }

        if (loadedTabs.length === 0) {
          const tab = newUntitledTab(1);
          tab.filePath = notePath(tab.fileName);
          await writeTextFile(tab.filePath, "", { baseDir: BASE });
          tab.savedContent = "";
          loadedTabs.push(tab);
        }

        if (cancelled) return;
        setTabs(loadedTabs);
        setActiveTabId(loadedTabs[0].id);
      } catch (err) {
        // 초기화 실패 시 빈 탭으로 시작
        console.error("biconote init error:", err);
        const tab = newUntitledTab(1);
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
  }, [noteDir]);

  const upsertTab = useCallback(
    async (fileName: string, content: string) => {
      const relPath = notePath(fileName);
      await writeTextFile(relPath, content, { baseDir: BASE });

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
          id: genId(),
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
    const content = await readTextFile(pathStr);
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
      clearSaveTimer(tabId);

      setTabs((prev) => {
        const tab = prev.find((t) => t.id === tabId);
        if (tab) {
          const content = tab.isModified ? tab.content : tab.savedContent;
          const isEmpty = !content.trim();

          if (isEmpty && tab.filePath) {
            // 빈 파일은 디스크에서 삭제
            remove(tab.filePath, { baseDir: BASE }).catch(() => {});
          } else {
            // 내용이 있는 탭만 복원 스택에 저장
            closedTabsRef.current = [
              tab,
              ...closedTabsRef.current.slice(0, MAX_CLOSED_TABS - 1),
            ];
            if (tab.isModified && tab.filePath) {
              writeTextFile(tab.filePath, tab.content, { baseDir: BASE }).catch(
                () => {}
              );
            }
          }
        }

        const remaining = prev.filter((t) => t.id !== tabId);
        if (remaining.length === 0) {
          const nextNum = getNextUntitledNumber(prev);
          const nt = newUntitledTab(nextNum);
          nt.filePath = notePath(nt.fileName);
          writeTextFile(nt.filePath, "", { baseDir: BASE }).catch(() => {});
          remaining.push(nt);
        }
        if (activeTabIdRef.current === tabId) {
          setActiveTabId(remaining[remaining.length - 1].id);
        }
        return remaining;
      });
    },
    [clearSaveTimer, noteDir]
  );

  const renameTab = useCallback(
    async (tabId: string, newName: string) => {
      const tab = tabsRef.current.find((t) => t.id === tabId);
      if (!tab || !newName.trim()) return;

      const trimmed = newName.trim();
      if (trimmed === tab.fileName) return;
      const oldPath = tab.filePath;
      const newPath = notePath(trimmed);

      try {
        if (oldPath) {
          await rename(oldPath, newPath, { oldPathBaseDir: BASE, newPathBaseDir: BASE });
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
        content = await readTextFile(closed.filePath, { baseDir: BASE });
      } catch {
        // 파일이 삭제된 경우 캐싱된 내용으로 복원 후 다시 저장
        await writeTextFile(closed.filePath, content, { baseDir: BASE }).catch(() => {});
      }
    }

    const tab: EditorTab = {
      id: genId(),
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
      const tab = newUntitledTab(nextNum);
      tab.filePath = notePath(tab.fileName);
      writeTextFile(tab.filePath, "", { baseDir: BASE }).catch(() => {});
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
