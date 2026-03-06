import { useState, useRef, useEffect, useCallback } from "react";
import type { EditorTab } from "../../types";

interface Props {
  tabs: EditorTab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
  onRenameTab?: (id: string, newName: string) => void;
}

interface ContextMenu {
  x: number;
  y: number;
  tabId: string;
}

export function TabBar({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onRenameTab,
}: Props) {
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // 컨텍스트 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [contextMenu]);

  // 이름 편집 시작 시 포커스
  useEffect(() => {
    if (editingTabId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingTabId]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, tabId });
    },
    []
  );

  const startRename = useCallback(
    (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab) return;
      setEditingTabId(tabId);
      setEditValue(tab.fileName);
      setContextMenu(null);
    },
    [tabs]
  );

  const commitRename = useCallback(() => {
    if (editingTabId && editValue.trim() && onRenameTab) {
      onRenameTab(editingTabId, editValue.trim());
    }
    setEditingTabId(null);
  }, [editingTabId, editValue, onRenameTab]);

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        commitRename();
      } else if (e.key === "Escape") {
        setEditingTabId(null);
      }
    },
    [commitRename]
  );

  return (
    <div className="tab-bar">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`tab ${tab.id === activeTabId ? "tab-active" : ""}`}
          onClick={() => onSelectTab(tab.id)}
          onContextMenu={(e) => handleContextMenu(e, tab.id)}
          onDoubleClick={() => startRename(tab.id)}
        >
          <span className="tab-name">
            {tab.isModified && <span className="tab-modified" />}
            {editingTabId === tab.id ? (
              <input
                ref={inputRef}
                className="tab-rename-input"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={handleRenameKeyDown}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              tab.fileName
            )}
          </span>
          <button
            className="tab-close"
            onClick={(e) => {
              e.stopPropagation();
              onCloseTab(tab.id);
            }}
          >
            ×
          </button>
        </div>
      ))}
      <button className="tab-new" onClick={onNewTab}>
        +
      </button>

      {contextMenu && (
        <div
          className="tab-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={() => startRename(contextMenu.tabId)}>
            이름 변경
          </button>
          <button
            onClick={() => {
              onCloseTab(contextMenu.tabId);
              setContextMenu(null);
            }}
          >
            탭 닫기
          </button>
          <button
            onClick={() => {
              const others = tabs.filter((t) => t.id !== contextMenu.tabId);
              others.forEach((t) => onCloseTab(t.id));
              setContextMenu(null);
            }}
          >
            다른 탭 모두 닫기
          </button>
          <hr />
          <button
            onClick={() => {
              onNewTab();
              setContextMenu(null);
            }}
          >
            새 파일
          </button>
        </div>
      )}
    </div>
  );
}
