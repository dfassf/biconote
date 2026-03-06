use super::{analyze_menu_with_gemini_with_endpoint, extract_json_array, extract_pure_base64};
use mockito::Server;
use serde_json::json;

#[test]
fn extracts_pure_base64_from_data_url() {
    assert_eq!(extract_pure_base64("data:image/png;base64,QUJD"), "QUJD");
    assert_eq!(extract_pure_base64("SEVMTE8="), "SEVMTE8=");
}

#[test]
fn extracts_json_array_from_wrapped_response() {
    let wrapped = "```json\n[{\"day\":\"월\",\"lunch\":[],\"dinner\":[]}]\n```";
    assert_eq!(
        extract_json_array(wrapped),
        "[{\"day\":\"월\",\"lunch\":[],\"dinner\":[]}]"
    );
}

#[tokio::test]
async fn parses_valid_response_from_mocked_gemini_api() {
    let mut server = Server::new_async().await;
    let endpoint = format!("{}/generate", server.url());
    let _mock = server
        .mock("POST", "/generate")
        .match_query(mockito::Matcher::UrlEncoded("key".into(), "api-key".into()))
        .with_status(200)
        .with_body(
            r#"{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "text": "```json\n[{\"day\":\"월\",\"lunch\":[],\"dinner\":[]}]\n```"
          }
        ]
      }
    }
  ]
}"#,
        )
        .create_async()
        .await;

    let client = reqwest::Client::new();
    let result = analyze_menu_with_gemini_with_endpoint(
        &client,
        "data:image/png;base64,QUJD",
        "api-key",
        &endpoint,
    )
    .await
    .expect("valid Gemini response should parse");

    let parsed: serde_json::Value =
        serde_json::from_str(&result).expect("result should be valid JSON");
    assert_eq!(parsed, json!([{ "day": "월", "lunch": [], "dinner": [] }]));
}

#[tokio::test]
async fn returns_error_on_non_success_response() {
    let mut server = Server::new_async().await;
    let endpoint = format!("{}/generate", server.url());
    let _mock = server
        .mock("POST", "/generate")
        .match_query(mockito::Matcher::UrlEncoded("key".into(), "api-key".into()))
        .with_status(500)
        .with_body("internal error")
        .create_async()
        .await;

    let client = reqwest::Client::new();
    let err = analyze_menu_with_gemini_with_endpoint(&client, "QUJD", "api-key", &endpoint)
        .await
        .expect_err("non-success response should return error");

    assert_eq!(err.code, "GEMINI_API_ERROR");
    assert!(err.message.contains("Gemini API 오류"));
    assert!(err.message.contains("internal error"));
}

#[tokio::test]
async fn returns_error_when_response_is_not_json_array() {
    let mut server = Server::new_async().await;
    let endpoint = format!("{}/generate", server.url());
    let _mock = server
        .mock("POST", "/generate")
        .match_query(mockito::Matcher::UrlEncoded("key".into(), "api-key".into()))
        .with_status(200)
        .with_body(
            r#"{
  "candidates": [
    {
      "content": {
        "parts": [
          { "text": "메뉴를 찾을 수 없습니다." }
        ]
      }
    }
  ]
}"#,
        )
        .create_async()
        .await;

    let client = reqwest::Client::new();
    let err = analyze_menu_with_gemini_with_endpoint(&client, "QUJD", "api-key", &endpoint)
        .await
        .expect_err("non JSON array text should fail validation");

    assert_eq!(err.code, "GEMINI_JSON_PARSE_FAILED");
    assert!(err.message.contains("Gemini 응답 JSON 파싱 실패"));
}

#[tokio::test]
async fn rejects_empty_api_key_before_request() {
    let client = reqwest::Client::new();
    let err =
        analyze_menu_with_gemini_with_endpoint(&client, "QUJD", "", "http://127.0.0.1:9/generate")
            .await
            .expect_err("empty api key must fail");

    assert_eq!(err.code, "GEMINI_API_KEY_MISSING");
    assert!(err.message.contains("Gemini API Key가 설정되지 않았습니다"));
}
