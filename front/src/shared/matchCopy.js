import { colorDisplayName, majorCategory } from './codes.js'

/**
 * 매칭 설명 문구 (docs/문구 규칙표.md). 규칙 기반, LLM 사용 안 함.
 * 매칭 결과(1a)와 습득물 상세(4a)에서 같이 쓴다.
 *
 * 입력
 *   tags      MatchTag[]   조건별 점수 (점수가 null/undefined면 "정보 없음")
 *   condition SearchCondition  사용자가 입력한 조건
 *   item      { prdtClNm, clrNm, fdYmd }  습득물
 */

export const TAG_LABELS = { category: '분류', color: '색상', date: '날짜', region: '지역' }
// 표시 순서 / 가장 낮은 조건이 여러 개일 때 고르는 순서 (규칙표 3번: 지역 → 날짜 → 색상 → 분류)
export const TAG_ORDER = ['category', 'color', 'date', 'region']
const TIE_ORDER = ['region', 'date', 'color', 'category']

const hasScore = (score) => typeof score === 'number' && Number.isFinite(score)

/** 규칙표 1번: 'match'(80↑) · 'partial'(50~79) · 'mismatch'(50↓) · 'unknown'(정보 없음) */
export function tagStatus(score) {
  if (!hasScore(score)) return 'unknown'
  if (score >= 80) return 'match'
  if (score >= 50) return 'partial'
  return 'mismatch'
}

/** 칩 기호 ✓ △ ✕ (정보 없음은 칩 숨김 → null) */
export const TAG_SYMBOL = { match: '✓', partial: '△', mismatch: '✕', unknown: null }

/** 규칙표 2번: 종합 점수 → 헤드라인 (40 미만은 결과에 표시하지 않으므로 null) */
export function headline(score) {
  if (score >= 80) return '입력하신 조건과 대부분 일치해요'
  if (score >= 60) return '일부 조건이 달라요'
  if (score >= 40) return '몇 가지 조건만 비슷해요'
  return null
}

const toUtc = (ymd) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10))

/** 분실일 대비 습득일 차이 (일). 분실 기간 안이면 0, 이후면 양수, 이전이면 음수 */
export function dayGap(condition = {}, fdYmd = '') {
  const from = condition.dateFrom
  const to = condition.dateTo || from
  if (!from || !fdYmd) return null
  if (fdYmd < from) return -Math.round((toUtc(from) - toUtc(fdYmd)) / 86_400_000)
  if (fdYmd > to) return Math.round((toUtc(fdYmd) - toUtc(to)) / 86_400_000)
  return 0
}

const subCategory = (prdtClNm = '') => (prdtClNm.split('>')[1] ?? prdtClNm).trim()

// 받침에 맞는 조사: 검정으로 / 보라로 (ㄹ 받침은 "로"), 지갑이지만 / 의류지만
function finalConsonant(word = '') {
  const code = word.trim().charCodeAt(word.trim().length - 1) - 0xac00
  if (code < 0 || code > 11171) return 0
  return code % 28 // 0이면 받침 없음, 8이면 ㄹ
}
export const withRo = (word) => `${word}${[0, 8].includes(finalConsonant(word)) ? '로' : '으로'}`
export const withIjiman = (word) => `${word}${finalConsonant(word) === 0 ? '지만' : '이지만'}`

/**
 * 규칙표 3번: 점수가 가장 낮은 조건 하나만 설명. 모두 80 이상이면 ''
 * 지역 문구의 {노선}·{구}는 점수 계산 쪽 지역 정보가 생기면 채운다. 지금은 시·도 단위 문구를 쓴다.
 */
export function subCopy(tags = [], { condition = {}, item = {} } = {}) {
  const known = tags.filter((t) => hasScore(t.score))
  if (known.length === 0 || known.every((t) => t.score >= 80)) return ''
  const lowest = [...known].sort(
    (a, b) => a.score - b.score || TIE_ORDER.indexOf(a.key) - TIE_ORDER.indexOf(b.key),
  )[0]
  const partial = lowest.score >= 50

  switch (lowest.key) {
    case 'region':
      return partial
        ? `${condition.region ? `${condition.region} 안이지만` : '가까운 곳이지만'} 잃어버린 장소와 떨어져 있어요`
        : '잃어버린 지역과 다른 곳에서 접수됐어요'
    case 'date': {
      const gap = dayGap(condition, item.fdYmd)
      if (gap === null || gap === 0) return '잃어버린 날과 습득일이 달라요'
      return gap > 0 ? `잃어버린 날보다 ${gap}일 뒤에 접수됐어요` : `잃어버린 날보다 ${-gap}일 먼저 습득된 물건이에요`
    }
    case 'color': {
      const color = colorDisplayName(item.clrNm)
      return partial
        ? `색상이 ${withRo(color)} 등록돼 있어요. 비슷한 색인지 확인해 주세요`
        : `색상이 ${withRo(color)} 달라요`
    }
    case 'category':
      return partial
        ? `같은 ${withIjiman(majorCategory(item.prdtClNm))} 세부 종류가 달라요`
        : `물품 종류가 ${withRo(majorCategory(item.prdtClNm))} 달라요`
    default:
      return ''
  }
}

/** 규칙표 4번: 상세 화면 진행 바 아래 메모 (정보 없음이면 '정보 없음') */
export function tagNote(tag, { condition = {}, item = {} } = {}) {
  const status = tagStatus(tag.score)
  if (status === 'unknown') return '정보 없음'

  switch (tag.key) {
    case 'category':
      return { match: subCategory(item.prdtClNm), partial: `같은 ${majorCategory(item.prdtClNm)}`, mismatch: '다른 분류' }[status]
    case 'color':
      return { match: colorDisplayName(item.clrNm), partial: '비슷한 색', mismatch: '다른 색' }[status]
    case 'date': {
      const gap = Math.abs(dayGap(condition, item.fdYmd) ?? 0)
      if (status === 'match') return gap === 0 ? '잃어버린 당일' : '잃어버린 다음 날'
      return status === 'partial' ? `${gap}일 차이` : `${gap}일 이상 차이`
    }
    case 'region':
      return { match: '같은 장소', partial: `같은 ${condition.region || '지역'} 다른 곳`, mismatch: '다른 지역' }[status]
    default:
      return ''
  }
}
