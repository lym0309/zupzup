import { mockGetNewCandidates, mockMarkSeen } from '../mocks/newCandidates.js'
import { api } from './client.js'

// TODO(@kwonminsooo): GET /api/lost-items/:id/new-candidates 가 머지되면 mock 삭제
// mock은 개발 환경에서만 (배포 빌드에서 가짜 후보가 보이지 않게)
const USE_MOCK = import.meta.env.DEV

/**
 * 신규 후보 한 건: 매칭 결과 + 접수일 + 보관장소 좌표
 * @typedef {import('../shared/types.js').MatchResult & {
 *   regYmd?: string,
 *   location?: { lat: number, lng: number } | null }} CandidateItem
 */

/**
 * 마지막 확인 이후 새로 들어온 습득물 (GET /api/lost-items/:id/new-candidates)
 * 조회만 한다. 서버 상태(마지막 조회 시각·본 후보)는 바꾸지 않으므로 새로고침·중복 요청에도 결과가 같다.
 * - 신규 후보 = 마지막 조회(lastViewedAt) 이후 처음 나타난 습득물 중, 본 후보·숨긴 후보를 뺀 것
 * - 마지막 조회 시각은 매칭 결과(1a)를 볼 때 별도 요청으로 갱신한다 (markViewed)
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

/**
 * 신규 후보를 "본 후보"로 기록 (PUT /api/lost-items/:id/seen-items/:atcId/:fdSn → 204, 여러 번 보내도 같음)
 * 상세로 들어갈 때 보낸다 → 다음 재조회 때 신규에서 빠지고 이전 결과로 간다
 */
export function markSeen(lostItemId, atcId, fdSn) {
  if (USE_MOCK) return mockMarkSeen(lostItemId, atcId, fdSn)
  const path = [lostItemId, 'seen-items', atcId, fdSn].map(encodeURIComponent).join('/')
  return api.put(`/api/lost-items/${path}`)
}

/**
 * 결과를 확인했다고 기록 (POST /api/lost-items/:id/viewed → 204). 마지막 조회 시각 갱신
 * TODO(@kim-ch2): 매칭 결과 화면(1a, #25)에서 결과를 다 불러온 뒤 한 번 호출
 */
export function markViewed(lostItemId) {
  return api.post(`/api/lost-items/${encodeURIComponent(lostItemId)}/viewed`)
}
