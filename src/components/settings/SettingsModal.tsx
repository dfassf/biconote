import { useState, useRef, useEffect } from "react";
import { open, ask } from "@tauri-apps/plugin-dialog";
import { exists, mkdir, BaseDirectory } from "@tauri-apps/plugin-fs";
import type { AppSettings } from "../../types";
import { THEMES, type ThemeId } from "../../types";

interface Props {
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  onClose: () => void;
}

export function SettingsModal({ settings, onSave, onClose }: Props) {
  const [token, setToken] = useState(settings.slackToken);
  const [channelName, setChannelName] = useState(settings.channelName);
  const [username, setUsername] = useState(settings.username);
  const [geminiApiKey, setGeminiApiKey] = useState(settings.geminiApiKey);
  const [noteDir, setNoteDir] = useState(settings.noteDir);
  const [theme, setTheme] = useState<ThemeId>(settings.theme);
  const originalTheme = useRef(settings.theme);

  // 테마 버튼 누르면 즉시 반영
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // 취소 시 원래 테마로 복원
  const handleClose = () => {
    document.documentElement.dataset.theme = originalTheme.current;
    onClose();
  };

  const handleBrowseDir = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") {
      // ~/Documents/ 하위 폴더명만 추출
      const docPath = "/Documents/";
      const idx = selected.indexOf(docPath);
      if (idx !== -1) {
        setNoteDir(selected.substring(idx + docPath.length));
      } else {
        setNoteDir(selected);
      }
    }
  };

  const handleSave = async () => {
    const dir = noteDir.trim() || "biconote";
    const dirExists = await exists(dir, { baseDir: BaseDirectory.Document });
    if (!dirExists) {
      const create = await ask(
        `"${dir}" 폴더가 존재하지 않습니다. 생성할까요?`,
        { title: "폴더 없음", kind: "warning" }
      );
      if (!create) return;
      await mkdir(dir, { baseDir: BaseDirectory.Document, recursive: true });
    }
    onSave({
      slackToken: token.trim(),
      channelName: channelName.trim(),
      username: username.trim(),
      geminiApiKey: geminiApiKey.trim(),
      noteDir: dir,
      theme,
    });
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>설정</h2>

        <div className="modal-field">
          <label>테마</label>
          <div className="theme-selector">
            {THEMES.map((t) => (
              <button
                key={t.id}
                className={`theme-btn ${theme === t.id ? "active" : ""}`}
                style={{
                  background: t.bg,
                  color: t.accent,
                  borderColor: theme === t.id ? t.accent : t.fg + "33",
                }}
                onClick={() => setTheme(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="modal-field">
          <label>Slack Token (xoxp-...)</label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="xoxp-..."
          />
        </div>

        <div className="modal-field">
          <label>채널명</label>
          <input
            type="text"
            value={channelName}
            onChange={(e) => setChannelName(e.target.value)}
            placeholder="전사-수다"
          />
        </div>

        <div className="modal-field">
          <label>식단 올리는 사람</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="홍길동"
          />
        </div>

        <div className="modal-field">
          <label>Gemini API Key</label>
          <input
            type="password"
            value={geminiApiKey}
            onChange={(e) => setGeminiApiKey(e.target.value)}
            placeholder="AIzaSy..."
          />
        </div>

        <div className="modal-field">
          <label>노트 저장 폴더 (~/Documents/ 하위)</label>
          <div className="input-with-btn">
            <input
              type="text"
              value={noteDir}
              onChange={(e) => setNoteDir(e.target.value)}
              placeholder="biconote"
            />
            <button
              type="button"
              className="btn-browse"
              onClick={handleBrowseDir}
            >
              ...
            </button>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-cancel" onClick={handleClose}>
            취소
          </button>
          <button className="btn-save" onClick={handleSave}>
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
