import type { EditorTab } from "../../types";

export const AUTOSAVE_DELAY = 1000;
export const MAX_CLOSED_TABS = 20;

export function createTabId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export function createUntitledTab(num: number): EditorTab {
  const fileName = `note-${num}.txt`;
  return {
    id: createTabId(),
    filePath: null,
    fileName,
    content: "",
    savedContent: "",
    isModified: false,
  };
}

export const INITIAL_TAB = createUntitledTab(1);

export const EMPTY_TAB: EditorTab = {
  id: "",
  filePath: null,
  fileName: "Untitled",
  content: "",
  savedContent: "",
  isModified: false,
};

export function getNextUntitledNumber(tabs: EditorTab[]): number {
  return (
    Math.max(
      0,
      ...tabs.map((tab) => {
        const matched = tab.fileName.match(/^note-(\d+)\.txt$/);
        return matched ? parseInt(matched[1], 10) : 0;
      })
    ) + 1
  );
}
