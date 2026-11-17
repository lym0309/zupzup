import { deviceHeaders } from '../shared/deviceId.js'
import { api } from './client.js'

/**
 * 분실물 등록 (POST /api/lost-items). 기기 ID를 같이 보내 이 기기의 검색 기록에 남긴다
 * @param {string} rawText
 * @returns {Promise<import('../shared/types.js').SearchCondition>}
 */
export function createLostItem(rawText) {
  return api.post('/api/lost-items', { rawText }, { headers: deviceHeaders() })
}

/**
 * 저장된 검색 조건 (GET /api/lost-items/:id). 없으면 404
 * @returns {Promise<import('../shared/types.js').SearchCondition>}
 */
export function getLostItem(lostItemId, { signal } = {}) {
  return api.get(`/api/lost-items/${encodeURIComponent(lostItemId)}`, { signal })
}

/**
 * 검색 조건 수정 (PATCH /api/lost-items/:id). 보낸 필드만 바뀌고 null이면 지운다
 * @returns {Promise<import('../shared/types.js').SearchCondition>}
 */
export function updateLostItem(lostItemId, condition) {
  return api.patch(`/api/lost-items/${encodeURIComponent(lostItemId)}`, condition)
}
