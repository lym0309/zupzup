import { api, request } from './client.js'

const lostItemPath = (lostItemId) => `/api/lost-items/${encodeURIComponent(lostItemId)}`
const hiddenPath = (lostItemId, atcId, fdSn) =>
  `${lostItemPath(lostItemId)}/hidden-items/${encodeURIComponent(atcId)}/${encodeURIComponent(fdSn)}`

/**
 * 매칭 결과 (GET /api/lost-items/:id/results). 점수 높은 순, 40점 미만·숨긴 습득물은 서버에서 제외
 * @returns {Promise<{ condition: import('../shared/types.js').SearchCondition,
 *                     items: import('../shared/types.js').MatchResult[] }>}
 */
export function getMatchResults(lostItemId, { signal } = {}) {
  return api.get(`${lostItemPath(lostItemId)}/results`, { signal })
}

/**
 * "내 물건이 아니에요": 이 분실물의 결과에서 숨기기 (서버 저장, 여러 번 해도 같음)
 * 조회 코드로 다른 기기에서 열어도 숨겨진 채로 보이고, 신규 후보에서도 빠진다.
 */
export function hideMatch(lostItemId, atcId, fdSn) {
  return request(hiddenPath(lostItemId, atcId, fdSn), { method: 'PUT' })
}

/** 숨기기 취소 */
export function unhideMatch(lostItemId, atcId, fdSn) {
  return api.delete(hiddenPath(lostItemId, atcId, fdSn))
}
