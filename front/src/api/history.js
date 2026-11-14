// 검색 기록 · 조회 코드 API (권민수)
// TODO(@kwonminsooo): 백엔드 GET /api/history · GET /api/lookup-codes/:code 구현 후 mock 대신 api 호출로 교체
//   getHistory:  api.get('/api/history', { headers: { 'X-Device-Id': deviceId } })
//   lookupCode:  api.get(`/api/lookup-codes/${code}`) — 404면 null
import { mockClearHistory, mockGetHistory, mockLookupCode } from '../mocks/history.js'

/** 이 기기의 검색 기록 + 결과 수 + 새 후보 수 */
export function getHistory() {
  return mockGetHistory()
}

/** 이 기기의 검색 기록 전체 삭제 */
export function clearHistory() {
  return mockClearHistory()
}

/**
 * 조회 코드 → lostItemId
 * @returns {Promise<{ lostItemId: string } | null>} 없는 코드면 null
 */
export function lookupCode(code) {
  return mockLookupCode(code)
}
