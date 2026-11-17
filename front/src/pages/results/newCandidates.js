// 신규 습득물 확인 화면(6a/6b) 규칙
import { isHidden } from '../../shared/hiddenItems.js'

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
 * 숨긴 습득물을 빼고 나눈다. 숨긴 건 수는 신규·이전 모두 센다
 * @param {{ newItems: object[], previousItems: object[] }} data
 * @param {Set<string>} hidden  hiddenItems.getHiddenItems() 결과
 */
export function splitHidden({ newItems, previousItems }, hidden) {
  const visible = (items) => items.filter((item) => !isHidden(hidden, item))
  const hiddenItems = [...newItems, ...previousItems].filter((item) => isHidden(hidden, item))
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
