// 매칭 점수 (순수 함수). 매칭 결과(1a)와 신규 후보(6a, @kwonminsooo)가 같이 쓴다.
//
// 조건별 0~100, 정보가 없으면 null(화면에서 "정보 없음", 종합 점수 계산에서 제외)
// 종합 = 정보가 있는 조건만 가중 평균 (초안 가중치: 분류 35 · 색상 20 · 날짜 25 · 지역 20)
import { colorFamily, isSimilarColor } from './colors.js'
import { majorCategory } from './foundItemCodes.js'
import { daysBetween } from './foundItemList.js'

export const WEIGHTS = { category: 35, color: 20, date: 25, region: 20 }
export const MIN_SCORE = 40 // 이 점수 미만은 결과에서 뺀다

const subCategory = (prdtClNm = '') => (prdtClNm.includes('>') ? prdtClNm.split('>')[1].trim() : '')

/**
 * 분류: 소분류까지 일치 100 / 대분류만 일치 55 / 불일치 0
 * 사용자가 대분류만 고른 경우(예: "전자기기")는 대분류가 같으면 100
 */
export function categoryScore(conditionClNm, itemClNm) {
  if (!conditionClNm || !itemClNm) return null
  if (majorCategory(conditionClNm) !== majorCategory(itemClNm)) return 0
  const wantSub = subCategory(conditionClNm)
  if (!wantSub) return 100
  return wantSub === subCategory(itemClNm) ? 100 : 55
}

/**
 * 색상: 같은 계열 100 / 비슷한 계열 60 / 다른 계열 10
 * 습득물 색이 "기타"(미분류)면 비교할 수 없어 null
 */
export function colorScore(conditionClr, itemClrNm) {
  if (!conditionClr || !itemClrNm) return null
  const want = colorFamily(conditionClr)
  const got = colorFamily(itemClrNm)
  if (want === '기타' || got === '기타') return null
  if (want === got) return 100
  return isSimilarColor(want, got) ? 60 : 10
}

/**
 * 날짜: 분실 기간 안(또는 당일) 100, 하루 뒤 95, 이후 하루마다 8점씩 감점
 * 분실일보다 먼저 습득된 건 내 물건일 가능성이 낮다: 하루 전 50(날짜 착오 감안), 그 이전 10
 */
export function dateScore(dateFrom, dateTo, fdYmd) {
  if (!dateFrom || !fdYmd) return null
  const to = dateTo || dateFrom
  if (fdYmd < dateFrom) return daysBetween(fdYmd, dateFrom) === 1 ? 50 : 10
  if (fdYmd <= to) return 100
  const gap = daysBetween(to, fdYmd)
  if (gap === 1) return 95
  return Math.max(0, 95 - (gap - 1) * 8)
}

// "서울 강남구 역삼역" → ["강남", "역삼"] (시·도 이름과 1글자는 빼고, 구·역·동 같은 끝말은 떼고 비교)
const PROVINCES = /^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)/
export function regionKeywords(region = '') {
  return region
    .split(/[\s,·]+/)
    .map((w) => w.replace(PROVINCES, '').replace(/(특별시|광역시|특별자치시|특별자치도|도|시|군|구|동|역|읍|면)$/, ''))
    .filter((w) => w.length >= 2)
}

/**
 * 지역: 장소(보관장소·습득장소·기관명)에 사용자 지역 키워드가 있으면 100
 * 키워드는 없지만 같은 시·도로 검색한 결과면 60 (지역 코드로 거른 결과)
 * 둘 다 판단할 수 없으면 null
 * @param {{ region?: string }} condition
 * @param {{ depPlace?: string, fdPlace?: string, orgNm?: string }} item
 * @param {{ sameProvince?: boolean }} opts  검색할 때 지역 코드로 걸렀는지
 */
export function regionScore(condition, item, { sameProvince = false } = {}) {
  const keywords = regionKeywords(condition.region)
  const places = [item.depPlace, item.fdPlace, item.orgNm].filter(Boolean).join(' ')
  if (keywords.length > 0 && keywords.some((k) => places.includes(k))) return 100
  if (sameProvince) return 60
  return keywords.length > 0 ? 10 : null
}

/**
 * 습득물 하나의 매칭 점수
 * @param {{ prdtClNm?: string, clrNm?: string, region?: string, dateFrom: string, dateTo?: string }} condition
 *   SearchCondition (front/src/shared/types.js) 중 점수에 쓰는 값
 * @param {{ prdtClNm: string, clrNm: string, fdYmd: string, depPlace?: string, fdPlace?: string, orgNm?: string }} item
 * @param {{ sameProvince?: boolean }} [opts]
 * @returns {{ score: number, tags: { key: 'category'|'color'|'date'|'region', score: number|null }[] }}
 */
export function scoreItem(condition, item, opts = {}) {
  const tags = [
    { key: 'category', score: categoryScore(condition.prdtClNm, item.prdtClNm) },
    { key: 'color', score: colorScore(condition.clrNm, item.clrNm) },
    { key: 'date', score: dateScore(condition.dateFrom, condition.dateTo, item.fdYmd) },
    { key: 'region', score: regionScore(condition, item, opts) },
  ]
  const known = tags.filter((t) => t.score !== null)
  const weight = known.reduce((sum, t) => sum + WEIGHTS[t.key], 0)
  const score = weight === 0 ? 0 : Math.round(known.reduce((sum, t) => sum + t.score * WEIGHTS[t.key], 0) / weight)
  return { score, tags }
}
