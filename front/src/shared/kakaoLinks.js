/**
 * 카카오맵 길찾기 링크
 * - 좌표가 있으면: https://map.kakao.com/link/to/{이름},{위도},{경도} (새 탭)
 * - 모바일 앱: kakaomap://route?ep={위도},{경도}&by=PUBLICTRANSIT
 * - 좌표가 없으면: 기관 이름으로 카카오맵 검색
 * @param {{ name: string, location?: { lat: number, lng: number } | null, mobile?: boolean }} p
 */
export function directionsUrl({ name, location, mobile = false }) {
  if (location) {
    if (mobile) return `kakaomap://route?ep=${location.lat},${location.lng}&by=PUBLICTRANSIT`
    return `https://map.kakao.com/link/to/${encodeURIComponent(name)},${location.lat},${location.lng}`
  }
  return `https://map.kakao.com/link/search/${encodeURIComponent(name)}`
}

export const isMobile = (userAgent = globalThis.navigator?.userAgent ?? '') =>
  /Android|iPhone|iPad|iPod/i.test(userAgent)

/** 전화 링크: 숫자와 - 만 남긴다. 번호가 없으면 null */
export function telUrl(tel = '') {
  const cleaned = tel.replace(/[^\d-]/g, '')
  return cleaned ? `tel:${cleaned}` : null
}
