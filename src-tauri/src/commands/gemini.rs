use serde::{Deserialize, Serialize};

use super::error::CommandError;

const GEMINI_GENERATE_API: &str =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

#[derive(Serialize)]
struct GeminiRequest {
    contents: Vec<Content>,
}

#[derive(Serialize)]
struct Content {
    parts: Vec<Part>,
}

#[derive(Serialize)]
#[serde(untagged)]
enum Part {
    Text { text: String },
    InlineData { inline_data: InlineData },
}

#[derive(Serialize)]
struct InlineData {
    mime_type: String,
    data: String,
}

#[derive(Deserialize)]
struct GeminiResponse {
    candidates: Option<Vec<Candidate>>,
}

#[derive(Deserialize)]
struct Candidate {
    content: Option<CandidateContent>,
}

#[derive(Deserialize)]
struct CandidateContent {
    parts: Option<Vec<ResponsePart>>,
}

#[derive(Deserialize)]
struct ResponsePart {
    text: Option<String>,
}

fn extract_pure_base64(image_base64: &str) -> String {
    if let Some(pos) = image_base64.find(',') {
        image_base64[pos + 1..].to_string()
    } else {
        image_base64.to_string()
    }
}

fn extract_json_array(raw: &str) -> String {
    if let Some(start) = raw.find('[') {
        if let Some(end) = raw.rfind(']') {
            raw[start..=end].to_string()
        } else {
            raw[start..].to_string()
        }
    } else {
        raw.to_string()
    }
}

async fn analyze_menu_with_gemini_with_endpoint(
    client: &reqwest::Client,
    image_base64: &str,
    api_key: &str,
    endpoint: &str,
) -> Result<String, CommandError> {
    if api_key.is_empty() {
        return Err(CommandError::new(
            "GEMINI_API_KEY_MISSING",
            "Gemini API Key가 설정되지 않았습니다. 설정에서 입력해주세요.",
        ));
    }

    // base64 data URL에서 순수 base64 추출
    let pure_b64 = extract_pure_base64(image_base64);

    let prompt = "이 이미지는 이번 주 점심 메뉴표입니다. 월요일부터 금요일까지 모든 요일의 메뉴를 JSON 배열로 추출해주세요.\n\
반드시 아래 JSON 형식으로만 답변하세요. 설명이나 다른 텍스트 없이 JSON만 출력하세요:\n\
[\n\
  {\"day\":\"월\",\"lunch\":[\"메뉴1\",\"메뉴2\"],\"dinner\":[\"메뉴1\",\"메뉴2\"]},\n\
  {\"day\":\"화\",\"lunch\":[\"메뉴1\",\"메뉴2\"],\"dinner\":[\"메뉴1\",\"메뉴2\"]},\n\
  {\"day\":\"수\",\"lunch\":[\"메뉴1\",\"메뉴2\"],\"dinner\":[\"메뉴1\",\"메뉴2\"]},\n\
  {\"day\":\"목\",\"lunch\":[\"메뉴1\",\"메뉴2\"],\"dinner\":[\"메뉴1\",\"메뉴2\"]},\n\
  {\"day\":\"금\",\"lunch\":[\"메뉴1\",\"메뉴2\"],\"dinner\":[\"메뉴1\",\"메뉴2\"]}\n\
]\n\
석식이 없는 날은 dinner를 빈 배열로 하세요. 메뉴 항목에 가격이나 괄호 안 설명이 있으면 포함하세요.";

    let request = GeminiRequest {
        contents: vec![Content {
            parts: vec![
                Part::Text {
                    text: prompt.to_string(),
                },
                Part::InlineData {
                    inline_data: InlineData {
                        mime_type: "image/png".to_string(),
                        data: pure_b64,
                    },
                },
            ],
        }],
    };

    let url = format!("{}?key={}", endpoint, api_key);

    let response = client.post(&url).json(&request).send().await.map_err(|e| {
        CommandError::new(
            "GEMINI_REQUEST_FAILED",
            format!("Gemini API 요청 실패: {}", e),
        )
    })?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(CommandError::new(
            "GEMINI_API_ERROR",
            format!("Gemini API 오류 ({}): {}", status, body),
        ));
    }

    let gemini_res: GeminiResponse = response.json().await.map_err(|e| {
        CommandError::new(
            "GEMINI_RESPONSE_PARSE_FAILED",
            format!("Gemini 응답 파싱 실패: {}", e),
        )
    })?;

    let raw = gemini_res
        .candidates
        .and_then(|c| c.into_iter().next())
        .and_then(|c| c.content)
        .and_then(|c| c.parts)
        .and_then(|p| p.into_iter().next())
        .and_then(|p| p.text)
        .unwrap_or_default()
        .trim()
        .to_string();

    // JSON 배열만 추출 (Gemini가 ```json ... ``` 래핑할 수 있으므로)
    let result = extract_json_array(&raw);

    // 유효한 JSON인지 검증
    serde_json::from_str::<serde_json::Value>(&result).map_err(|e| {
        CommandError::new(
            "GEMINI_JSON_PARSE_FAILED",
            format!("Gemini 응답 JSON 파싱 실패: {}. 원본: {}", e, result),
        )
    })?;

    Ok(result)
}

#[tauri::command]
pub async fn analyze_menu_with_gemini(
    image_base64: String,
    api_key: String,
) -> Result<String, CommandError> {
    let client = reqwest::Client::new();
    analyze_menu_with_gemini_with_endpoint(&client, &image_base64, &api_key, GEMINI_GENERATE_API)
        .await
}

#[cfg(test)]
#[path = "gemini_tests.rs"]
mod gemini_tests;
