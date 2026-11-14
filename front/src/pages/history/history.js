// 검색 기록 · 조회 코드 화면(5a) 규칙

// 조회 코드: FND-XXXX-XX. 헷갈리는 0/O, 1/I는 쓰지 않는다
const CODE_CHAR = '[A-HJ-NP-Z2-9]'
const CODE_PATTERN = new RegExp(`^FND-${CODE_CHAR}{4}-${CODE_CHAR}{2}$`)

export const CODE_PLACEHOLDER = '예: FND-7K2Q-48'
export const CODE_FORMAT_ERROR = '조회 코드는 FND-XXXX-XX 형식이에요'
export const CODE_NOT_FOUND_ERROR = '이 조회 코드로 저장된 검색이 없어요. 코드를 다시 확인해 주세요'

/** 조회 코드가 형식에 맞는지 */
export function isValidCode(code) {
  return CODE_PATTERN.test(code)
}

/**
 * 입력칸 값 정리: 자동 대문자, 영문·숫자 외 제거, 자리에 맞게 하이픈 삽입
 * "fnd7k2q48" → "FND-7K2Q-48"
 */
export function formatCodeInput(value) {
  const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 9)
  const parts = [raw.slice(0, 3), raw.slice(3, 7), raw.slice(7, 9)].filter(Boolean)
  return parts.join('-')
}

const pad = (n) => String(n).padStart(2, '0')

/** ISO 시각 → "2026.11.12 14:30" (기기 시간대 기준) */
export function formatSearchedAt(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** "2026-11-10" → "11.10" */
const shortDate = (ymd) => {
  const [, m, d] = ymd.split('-')
  return `${m}.${d}`
}

/** 분실 날짜 칩: 하루면 "11.12", 기간이면 "11.10 ~ 11.12" */
export function dateRangeLabel(dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return null
  if (!dateFrom || !dateTo || dateFrom === dateTo) return shortDate(dateFrom || dateTo)
  return `${shortDate(dateFrom)} ~ ${shortDate(dateTo)}`
}

/**
 * 기록 카드의 조건 칩 (물품 · 색상 · 지역 · 날짜). 모르는 조건은 칩을 숨긴다
 * @param {import('../../shared/types.js').SearchCondition} condition
 */
export function conditionChips(condition) {
  return [
    condition.itemName,
    condition.clrNm,
    condition.region,
    dateRangeLabel(condition.dateFrom, condition.dateTo),
  ].filter(Boolean)
}
