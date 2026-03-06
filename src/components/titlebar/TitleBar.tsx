interface Props {
  onOpenFile: () => void;
  onOpenSettings: () => void;
}

export function TitleBar({ onOpenFile, onOpenSettings }: Props) {
  return (
    <div className="title-bar">
      <div className="title-bar-actions">
        <button onClick={onOpenFile} title="파일 열기 (Cmd+O)">
          파일 열기
        </button>
      </div>
      <button className="title-bar-settings" onClick={onOpenSettings}>
        설정
      </button>
    </div>
  );
}
