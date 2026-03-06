# BICONOTE

점심이 보이는 메모장

Sublime Text 스타일을 참고한 데스크톱 메모장 앱입니다.
Slack 채널에 올라온 주간 식단 이미지를 자동으로 가져와 Gemini Vision으로 OCR 파싱하여, 오늘의 점심/석식 메뉴를 사이드바에 보여줍니다.

## 주요 기능

- CodeMirror 기반 멀티탭 텍스트 에디터 (9종 테마)
- Slack API로 점심 메뉴 이미지 자동 검색
- Gemini API로 메뉴표 이미지 → JSON 파싱
- 요일별 메뉴 자동 표시 (월~금)
- 파일 드래그 앤 드롭 지원
- 로컬 파일 저장 (`~/Documents/` 하위)

## 기술 스택

- **프론트엔드**: React 19 + TypeScript + Vite
- **데스크톱**: Tauri 2 (Rust)
- **에디터**: CodeMirror 6
- **외부 API**: Slack Web API, Google Gemini API

## 설치 및 실행

```bash
# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env
# .env 파일에 토큰 입력

# 개발 모드 실행
npm run tauri dev

# 프로덕션 빌드
npm run tauri build
```

## 환경변수

| 변수명 | 설명 |
|---|---|
| `VITE_SLACK_TOKEN` | Slack User Token (`xoxp-...`) |
| `VITE_CHANNEL_NAME` | 식단이 올라오는 Slack 채널명 |
| `VITE_USERNAME` | 식단을 올리는 사람의 표시 이름 |
| `VITE_GEMINI_API_KEY` | Google Gemini API Key |

앱 내 설정(`Cmd+,`)에서도 변경 가능합니다.

## About 다이얼로그 수정

앱 메뉴의 About(정보) 다이얼로그에 개발자 이름이나 저작권을 표시하려면 `src-tauri/src/lib.rs`의 `AboutMetadata`를 수정하세요.

```rust
.about(Some(AboutMetadata {
    name: Some("비코노트".into()),
    version: Some("1.0.0".into()),
    copyright: Some("© 2026 Your Name".into()),
    credits: Some("Created by 홍길동".into()),
    ..Default::default()
}))
