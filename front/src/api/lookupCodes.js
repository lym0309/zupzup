import { api } from './client.js'

/**
 * 조회 코드 발급 (나중에 같은 검색 결과를 다시 열기 위한 코드). 이미 있으면 같은 코드
 * @returns {Promise<{ code: string, lostItemId: string }>}
 */
export function createLookupCode(lostItemId) {
  return api.post('/api/lookup-codes', { lostItemId })
}
