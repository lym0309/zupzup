// 신규 습득물 확인 화면(6a/6b) 규칙

const toUtc = (ymd) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10))

/** 접수일 → "오늘 접수" / "어제 접수" / "3일 전 접수" (today: KST YYYY-MM-DD) */
export function receivedLabel(regYmd, today) {
  if (!regYmd || !today) return null
  const days = Math.round((toUtc(today) - toUtc(regYmd)) / 86_400_000)
  if (days <= 0) return '오늘 접수'
  if (days === 1) return '어제 접수'
  return `${days}일 전 접수`
}

/** ISO 시각 → "11월 14일" (기기 시간대 기준) */
export function formatLastViewed(iso) {
  const d = new Date(iso ?? '')
  if (Number.isNaN(d.getTime())) return null
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

/** 헤더 보조 문구: "마지막 확인 11월 14일 이후 · 조회 코드 FND-7K2Q-48" */
export function headerSub({ lastViewedAt, lookupCode }) {
  const viewed = formatLastViewed(lastViewedAt)
  return [viewed && `마지막 확인 ${viewed} 이후`, lookupCode && `조회 코드 ${lookupCode}`].filter(Boolean).join(' · ')
}

export const itemId = ({ atcId, fdSn }) => `${atcId}-${fdSn}`

/**
 * 숨긴 습득물을 신규·이전에서 빼고 따로 모은다.
 * "내 물건이 아니에요"로 숨긴 목록은 서버(hidden_items)에 있고, new-candidates 응답의 hiddenItems로 온다.
 * 서버가 이미 뺐어도 한 번 더 걸러서 같은 습득물이 두 번 보이지 않게 한다.
 * @param {{ newItems: object[], previousItems: object[], hiddenItems?: object[] }} data
 */
export function splitHidden({ newItems, previousItems, hiddenItems = [] }) {
  const hiddenIds = new Set(hiddenItems.map(itemId))
  const visible = (items) => items.filter((item) => !hiddenIds.has(itemId(item)))
  return { newItems: visible(newItems), previousItems: visible(previousItems), hiddenItems }
}

/**
 * 지도 핀: 신규 주색(선택 28px, 기본 20px) / 이전 회색 16px. 좌표 없는 습득물은 빠진다(지도가 알아서 거름)
 */
export function mapPins({ newItems, previousItems }, selectedId) {
  const pin = (tone) => (item) => ({
    id: itemId(item),
    lat: item.location?.lat,
    lng: item.location?.lng,
    title: item.fdPrdtNm,
    tone,
    selected: itemId(item) === selectedId,
  })
  return [...previousItems.map(pin('previous')), ...newItems.map(pin('new'))]
}
