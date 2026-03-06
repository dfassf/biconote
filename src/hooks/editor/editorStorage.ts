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
import type { EditorTab } from "../../types";
import { createTabId, createUntitledTab } from "./tabUtils";

const BASE = BaseDirectory.Document;

export function buildNotePath(noteDir: string, fileName: string): string {
  return `${noteDir}/${fileName}`;
}

export async function initializeTabs(noteDir: string): Promise<EditorTab[]> {
  const dirExists = await exists(noteDir, { baseDir: BASE });
  if (!dirExists) {
    await mkdir(noteDir, { baseDir: BASE, recursive: true });
  }

  const entries = await readDir(noteDir, { baseDir: BASE });
  const loadedTabs: EditorTab[] = [];

  for (const entry of entries) {
    if (!entry.isFile || !entry.name) continue;

    const relPath = buildNotePath(noteDir, entry.name);
    try {
      const content = await readTextFile(relPath, { baseDir: BASE });
      loadedTabs.push({
        id: createTabId(),
        filePath: relPath,
        fileName: entry.name,
        content,
        savedContent: content,
        isModified: false,
      });
    } catch {
      // 읽기 실패 파일은 무시
    }
  }

  if (loadedTabs.length === 0) {
    const tab = createUntitledTab(1);
    tab.filePath = buildNotePath(noteDir, tab.fileName);
    await writeTextFile(tab.filePath, "", { baseDir: BASE });
    tab.savedContent = "";
    loadedTabs.push(tab);
  }

  return loadedTabs;
}

export async function readExternalFile(path: string): Promise<string> {
  return readTextFile(path);
}

export async function writeNoteFile(
  noteDir: string,
  fileName: string,
  content: string
): Promise<string> {
  const relPath = buildNotePath(noteDir, fileName);
  await writeTextFile(relPath, content, { baseDir: BASE });
  return relPath;
}

export async function writeRelativeFile(filePath: string, content: string): Promise<void> {
  await writeTextFile(filePath, content, { baseDir: BASE });
}

export async function readRelativeFile(filePath: string): Promise<string> {
  return readTextFile(filePath, { baseDir: BASE });
}

export async function removeRelativeFile(filePath: string): Promise<void> {
  await remove(filePath, { baseDir: BASE });
}

export async function renameRelativeFile(oldPath: string, newPath: string): Promise<void> {
  await rename(oldPath, newPath, {
    oldPathBaseDir: BASE,
    newPathBaseDir: BASE,
  });
}
