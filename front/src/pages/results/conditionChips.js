/**
 * 매칭 결과 헤더의 조건 칩 (시안 예: 무선이어폰 케이스 · 검정 · 서울 지하철 2호선 · 11월 9일)
 * @param {import('../../shared/types.js').SearchCondition} condition
 * @returns {string[]}
 */
export function conditionChips(condition = {}) {
  return [condition.itemName || condition.prdtClNm, condition.brand, condition.clrNm, condition.region, dateLabel(condition), condition.feature]
    .map((v) => (v ?? '').trim())
    .filter(Boolean)
}

const md = (ymd) => ({ m: Number(ymd.slice(5, 7)), d: Number(ymd.slice(8, 10)) })

/** 분실 날짜 칩: 11월 9일 / 11월 5일~7일 / 10월 30일~11월 2일 */
export function dateLabel({ dateFrom, dateTo } = {}) {
  if (!dateFrom) return ''
  const from = md(dateFrom)
  if (!dateTo || dateTo === dateFrom) return `${from.m}월 ${from.d}일`
  const to = md(dateTo)
  return from.m === to.m ? `${from.m}월 ${from.d}일~${to.d}일` : `${from.m}월 ${from.d}일~${to.m}월 ${to.d}일`
}
