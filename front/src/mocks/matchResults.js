// mock: GET /api/lost-items/:id/results 중 습득물 한 건 (매칭 결과 API가 생기면 삭제)
// 상세 화면의 매칭 설명 카드를 미리 보기 위한 고정 값이다.

/** @returns {{ condition: import('../shared/types.js').SearchCondition,
 *             match: { score: number, tags: import('../shared/types.js').MatchTag[] }, total: number }} */
export function mockMatchFor(lostItemId, item) {
  const lostDay = shiftDays(item.fdYmd, -1) // 습득 하루 전에 잃어버린 것으로
  const tags = [
    { key: 'category', score: 100 },
    { key: 'color', score: 60 },
    { key: 'date', score: 95 },
    { key: 'region', score: 55 },
  ]
  // 백엔드 초안 가중치: 분류 35 · 색상 20 · 날짜 25 · 지역 20
  const score = Math.round((100 * 35 + 60 * 20 + 95 * 25 + 55 * 20) / 100)
  return {
    condition: {
      lostItemId,
      rawText: '(mock) 어제 서울에서 검정 지갑을 잃어버렸어요',
      itemName: item.fdPrdtNm,
      prdtClNm: item.prdtClNm,
      clrNm: '검정',
      region: '서울',
      dateFrom: lostDay,
      dateTo: lostDay,
    },
    match: { score, tags },
    total: 4,
  }
}

function shiftDays(ymd, days) {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
