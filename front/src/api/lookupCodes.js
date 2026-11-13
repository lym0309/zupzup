import { mockCreateLookupCode } from '../mocks/lookupCodes.js'
import { api } from './client.js'

// TODO(@kwonminsooo): POST /api/lookup-codes가 머지되면 false로 바꾸고 mock 삭제
const USE_MOCK = true

/**
 * 조회 코드 발급 (나중에 같은 검색 결과를 다시 열기 위한 코드)
 * @returns {Promise<{ code: string, lostItemId: string }>}
 */
export function createLookupCode(lostItemId) {
  if (USE_MOCK) return mockCreateLookupCode(lostItemId)
  return api.post('/api/lookup-codes', { lostItemId })
}
