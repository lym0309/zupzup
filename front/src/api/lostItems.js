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
