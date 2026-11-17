# mocks

아직 없는 API 대신 쓰는 임시 데이터입니다. 실제 API가 머지되면 해당 mock과 `USE_MOCK` 플래그를 지워 주세요.

| 파일 | 대신하는 API | 담당 | 쓰는 곳 |
|---|---|---|---|
| `lookupCodes.js` | `POST /api/lookup-codes` | @kwonminsooo | 상세 4a "조회 코드 저장" |
| `matchResults.js` | `GET /api/lost-items/:id/results` | @kim-ch2 | 상세 4a 매칭 설명 카드 |
