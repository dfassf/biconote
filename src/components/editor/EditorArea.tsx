import { useMemo, useRef, useEffect, useCallback } from "react";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { sublime } from "@uiw/codemirror-theme-sublime";
import { javascript } from "@codemirror/lang-javascript";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { json } from "@codemirror/lang-json";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";

interface Props {
  content: string;
  onChange: (value: string) => void;
  fileName: string;
  fontSize: number;
  tabId: string;
}

function getLangExt(fileName: string): Extension[] {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "js":
    case "jsx":
      return [javascript({ jsx: true })];
    case "ts":
    case "tsx":
      return [javascript({ jsx: true, typescript: true })];
    case "md":
    case "markdown":
      return [markdown()];
    case "py":
      return [python()];
    case "json":
      return [json()];
    case "html":
    case "htm":
      return [html()];
    case "css":
    case "scss":
      return [css()];
    default:
      return [];
  }
}

export function EditorArea({ content, onChange, fileName, fontSize, tabId }: Props) {
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const lastTabIdRef = useRef(tabId);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const fontTheme = useMemo(
    () =>
      EditorView.theme({
        "&": { fontSize: `${fontSize}px` },
        ".cm-content": {
          fontSize: `${fontSize}px`,
          fontFamily: "'SF Mono', 'Fira Code', Menlo, Consolas, monospace",
          lineHeight: "1.6",
        },
        ".cm-gutters": { fontSize: `${fontSize}px` },
        ".cm-line": { lineHeight: "1.6" },
        ".cm-activeLine": { lineHeight: "1.6" },
      }),
    [fontSize]
  );

  // 탭이 바뀔 때만 에디터 내용을 외부 content로 동기화
  useEffect(() => {
    if (tabId !== lastTabIdRef.current) {
      lastTabIdRef.current = tabId;
      const view = editorRef.current?.view;
      if (view) {
        const currentDoc = view.state.doc.toString();
        if (currentDoc !== content) {
          view.dispatch({
            changes: { from: 0, to: currentDoc.length, insert: content },
          });
        }
      }
    }
  }, [tabId, content]);

  const handleChange = useCallback((value: string) => {
    onChangeRef.current(value);
  }, []);

  return (
    <div className="editor-area">
      <CodeMirror
        ref={editorRef}
        value={content}
        onChange={handleChange}
        theme={sublime}
        extensions={[...getLangExt(fileName), fontTheme]}
        height="100%"
        style={{ height: "100%" }}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: true,
          highlightActiveLine: true,
          foldGutter: true,
          bracketMatching: true,
          autocompletion: true,
          tabSize: 2,
        }}
      />
    </div>
  );
}
