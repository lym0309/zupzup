# mocks

아직 없는 API 대신 쓰는 임시 데이터입니다. 실제 API가 머지되면 해당 mock과 `USE_MOCK` 플래그를 지워 주세요.

| 파일 | 대신하는 API | 담당 | 쓰는 곳 |
|---|---|---|---|
| `newCandidates.js` | `GET /api/lost-items/:id/new-candidates` | @kwonminsooo | 신규 습득물 6a/6b (`/results/mock-empty?new=1` 이면 새 습득물 0건 6b) |
