// 조건 확인·수정 화면(3a/3b) 규칙. 서버 검증(backend rules/searchCondition.js)과 같은 기준
import { CATEGORIES, COLOR_FAMILIES, REGIONS } from '../../shared/codes.js'

/** PATCH로 보내는 조건 필드 (공유 계약 SearchCondition, 코드는 서버가 계산) */
export const CONDITION_FIELDS = ['itemName', 'prdtClNm', 'clrNm', 'region', 'dateFrom', 'dateTo', 'brand', 'feature']

/**
 * 3a 조건 칩. key가 'date'인 칩은 dateFrom·dateTo 두 값을 같이 다룬다
 * - text: 직접 입력 (max = 서버 글자 수 제한)
 * - select: 서버가 정해진 이름만 받으므로 목록에서 고른다
 */
export const CHIP_FIELDS = [
  { key: 'itemName', label: '물품', type: 'text', max: 100 },
  { key: 'prdtClNm', label: '분류', type: 'select', options: CATEGORIES.map((c) => c.name) },
  { key: 'clrNm', label: '색상', type: 'select', options: COLOR_FAMILIES },
  { key: 'region', label: '지역', type: 'select', options: REGIONS.map((r) => r.name) },
  { key: 'date', label: '날짜', type: 'date' },
  { key: 'brand', label: '브랜드', type: 'text', max: 50 },
  { key: 'feature', label: '특징', type: 'text', max: 200 },
]

/** 오늘 날짜 (한국 시간) YYYY-MM-DD — 서버도 KST 기준으로 "오늘 이후"를 막는다 */
export function todayKst(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(now)
}

/** "2026-11-17" + (-1) → "2026-11-16" */
export function shiftYmd(ymd, days) {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** 날짜 표기: 하루면 "2026-11-04", 기간이면 "2026-11-03 ~ 2026-11-05" */
export function dateLabel({ dateFrom, dateTo }) {
  if (!dateFrom && !dateTo) return null
  if (!dateFrom || !dateTo || dateFrom === dateTo) return dateFrom || dateTo
  return `${dateFrom} ~ ${dateTo}`
}

/** 칩에 보여줄 값 (없으면 null → 칩 숨김) */
export function chipValue(key, condition) {
  if (key === 'date') return dateLabel(condition)
  return condition[key] || null
}

/** 아직 없는 조건 ("+ 조건 추가" 목록) */
export const missingFields = (condition) => CHIP_FIELDS.filter((f) => chipValue(f.key, condition) === null)

/** 날짜 범위 검사 (서버 dateRangeError와 같은 문구). 문제 없으면 null */
export function dateRangeError({ dateFrom, dateTo }, today) {
  if (dateFrom && dateTo && dateFrom > dateTo) return '시작 날짜가 끝 날짜보다 늦어요.'
  if ((dateFrom && dateFrom > today) || (dateTo && dateTo > today)) return '오늘 이후 날짜는 고를 수 없어요.'
  return null
}

/**
 * 칩 수정 적용. draft는 text·select면 문자열, date면 { dateFrom, dateTo }
 * 빈 값이면 조건을 지운다. 날짜는 끝 날짜를 비우면 시작 날짜 하루로 본다
 */
export function applyEdit(condition, key, draft) {
  if (key === 'date') {
    const dateFrom = draft?.dateFrom || draft?.dateTo || null
    const dateTo = draft?.dateTo || dateFrom
    return { ...condition, dateFrom, dateTo }
  }
  const value = typeof draft === 'string' ? draft.trim() : ''
  return { ...condition, [key]: value || null }
}

export const removeField = (condition, key) => applyEdit(condition, key, key === 'date' ? null : '')

/** 칩 수정 팝오버의 시작 값 */
export function draftOf(condition, key) {
  if (key === 'date') return { dateFrom: condition.dateFrom ?? '', dateTo: condition.dateTo ?? '' }
  return condition[key] ?? ''
}

/** "이 조건으로 찾기"를 누를 수 있는지: 물품(이름 또는 분류) + 날짜 (서버 isSearchable과 같음) */
export function canSearch({ itemName, prdtClNm, dateFrom, dateTo }) {
  return Boolean((itemName || prdtClNm) && dateFrom && dateTo)
}

/** 3a 하단 날짜 안내 */
export function dateNotice(condition) {
  const { dateFrom, dateTo } = condition
  if (!dateFrom || !dateTo) return '물품과 날짜를 정하면 찾아볼 수 있어요'
  if (dateFrom === dateTo) return `${dateFrom}에 잃어버린 물건으로 찾아요`
  return `${dateFrom} ~ ${dateTo} 사이에 잃어버린 물건으로 찾아요`
}

/** PATCH 본문: 조건 필드 전부 (빈 값은 null = 지움) */
export function toPatchBody(condition) {
  return Object.fromEntries(
    CONDITION_FIELDS.map((f) => {
      const v = condition[f]
      return [f, typeof v === 'string' && v.trim() ? v.trim() : null]
    }),
  )
}

/** API 응답 → 화면에서 고치는 조건 (조건 필드만) */
export const conditionOf = (item) => Object.fromEntries(CONDITION_FIELDS.map((f) => [f, item?.[f] ?? null]))

/* ── 3b 날짜 드롭다운 ── */

/** 3b 날짜 선택지 (오늘 포함 기간) */
export const DATE_PRESETS = [
  { id: 'today', label: '오늘', from: 0, to: 0 },
  { id: 'yesterday', label: '어제', from: -1, to: -1 },
  { id: '3d', label: '최근 3일', from: -2, to: 0 },
  { id: '7d', label: '최근 7일', from: -6, to: 0 },
]

/** 선택지 → { dateFrom, dateTo } (모르는 id면 둘 다 null) */
export function presetRange(id, today) {
  const p = DATE_PRESETS.find((x) => x.id === id)
  if (!p) return { dateFrom: null, dateTo: null }
  return { dateFrom: shiftYmd(today, p.from), dateTo: shiftYmd(today, p.to) }
}

/** 저장된 날짜가 어느 선택지인지 ('' = 없음, 'custom' = 선택지에 없는 날짜) */
export function presetOf({ dateFrom, dateTo }, today) {
  if (!dateFrom || !dateTo) return ''
  const hit = DATE_PRESETS.find((p) => {
    const r = presetRange(p.id, today)
    return r.dateFrom === dateFrom && r.dateTo === dateTo
  })
  return hit ? hit.id : 'custom'
}
