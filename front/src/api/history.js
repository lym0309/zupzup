// 검색 기록 · 조회 코드 API (권민수). 기기는 client.js가 X-Device-Id 헤더로 알려준다
import { ApiError, api } from './client.js'

/**
 * 검색 기록 한 건 (GET /api/history)
 * @typedef {Object} HistoryEntry
 * @property {import('../shared/types.js').SearchCondition} condition
 * @property {string|null} lookupCode     조회 코드 FND-XXXX-XX
 * @property {string} searchedAt          검색 시각 (ISO)
 * @property {number|null} resultCount    매칭 결과 수 (매칭 결과 API 연결 전까지 null)
 * @property {number} newCount            마지막 조회 이후 새 후보 수
 */

/** 이 기기의 검색 기록 + 결과 수 + 새 후보 수 → { items: HistoryEntry[] } */
export function getHistory() {
  return api.get('/api/history')
}

/** 이 기기의 검색 기록 전체 삭제 */
export function clearHistory() {
  return api.delete('/api/history')
}

/**
 * 조회 코드 → lostItemId
 * @returns {Promise<{ code: string, lostItemId: string } | null>} 없는 코드면 null
 */
export async function lookupCode(code) {
  try {
    return await api.get(`/api/lookup-codes/${encodeURIComponent(code)}`)
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}
