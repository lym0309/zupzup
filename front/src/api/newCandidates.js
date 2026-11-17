import { mockGetNewCandidates } from '../mocks/newCandidates.js'
import { api } from './client.js'

// TODO(@kwonminsooo): GET /api/lost-items/:id/new-candidates 가 머지되면 false로 바꾸고 mock 삭제
const USE_MOCK = true

/**
 * 신규 후보 한 건: 매칭 결과 + 접수일 + 보관장소 좌표
 * @typedef {import('../shared/types.js').MatchResult & {
 *   regYmd?: string,
 *   location?: { lat: number, lng: number } | null }} CandidateItem
 */

/**
 * 마지막 확인 이후 새로 들어온 습득물 (GET /api/lost-items/:id/new-candidates)
 * 응답 후 서버가 마지막 조회 시각을 갱신한다.
 * @returns {Promise<{ lostItemId: string,
 *   condition: import('../shared/types.js').SearchCondition,
 *   lookupCode: string | null,
 *   lastViewedAt: string | null,
 *   newItems: CandidateItem[],
 *   previousItems: CandidateItem[] }>}
 */
export function getNewCandidates(lostItemId, { signal } = {}) {
  if (USE_MOCK) return mockGetNewCandidates(lostItemId)
  return api.get(`/api/lost-items/${encodeURIComponent(lostItemId)}/new-candidates`, { signal })
}
