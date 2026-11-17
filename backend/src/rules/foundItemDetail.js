// 습득물 상세 응답 정리 규칙 (순수 함수)

/**
 * 상세 API에는 색상(clrNm) 필드가 없어 안내문(uniq)에서 꺼낸다.
 * 안내문 형식: "… [2026.11.12]  [지갑(블랙(검정)색)]을 습득/보관 하였습니다."
 * → "블랙(검정)". 못 찾으면 ''
 */
export function colorFromUniq(uniq = '') {
  const m = uniq.match(/\(([^()]*(?:\([^()]*\))?)색\)\]\s*을\s*습득/)
  return m ? m[1].trim() : ''
}

/**
 * 특이사항: 안내문의 "특이사항 :" 뒤 텍스트. "없음"이거나 비어 있으면 ''
 */
export function memoFromUniq(uniq = '') {
  const m = uniq.match(/특이사항\s*:\s*([\s\S]*)$/)
  const memo = m ? m[1].trim() : ''
  return memo === '없음' ? '' : memo
}
