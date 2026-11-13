import { env } from '../config/env.js'

// 카카오 로컬 키워드 검색: 보관기관 이름(orgNm) → 좌표 (지도 핀·길찾기용)
// 키(KAKAO_REST_API_KEY)가 없으면 항상 null을 돌려준다 (지도 없이 화면은 동작)
const SEARCH_URL = 'https://dapi.kakao.com/v2/local/search/keyword.json'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 기관 위치는 잘 바뀌지 않음
const CACHE_MAX = 500

export function createKakaoLocal({ restApiKey = env.kakao.restApiKey, fetchFn = fetch, timeoutMs = 5000 } = {}) {
  const cache = new Map() // query → { expiresAt, value }

  /** @returns {Promise<{ lat: number, lng: number, placeName: string, address: string } | null>} */
  async function searchPlace(query) {
    if (!restApiKey || !query) return null
    const hit = cache.get(query)
    if (hit && hit.expiresAt > Date.now()) return hit.value

    let value = null
    try {
      const res = await fetchFn(`${SEARCH_URL}?${new URLSearchParams({ query, size: '1' })}`, {
        headers: { Authorization: `KakaoAK ${restApiKey}` },
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const doc = (await res.json()).documents?.[0]
      if (doc) {
        value = {
          lat: Number(doc.y),
          lng: Number(doc.x),
          placeName: doc.place_name,
          address: doc.road_address_name || doc.address_name,
        }
      }
    } catch (err) {
      // 좌표는 부가 정보라 실패해도 상세 응답은 보낸다 (캐시하지 않고 다음에 다시 시도)
      console.warn(`[kakao] 좌표 검색 실패 (${query}): ${err.message}`)
      return null
    }

    cache.set(query, { expiresAt: Date.now() + CACHE_TTL_MS, value })
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value)
    return value
  }

  return { searchPlace, enabled: Boolean(restApiKey) }
}
