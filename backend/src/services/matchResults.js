import { categoryCode, majorCategory, REGIONS } from '../rules/foundItemCodes.js'
import { addDays, isNewItem, registrationDate, todayKst } from '../rules/foundItemList.js'
import { MIN_SCORE, scoreItem } from '../rules/score.js'
import { SOURCE_NAMES } from './policeApi.js'
import { scanPages } from './scan.js'

// 습득일은 분실일 하루 전부터, 분실 후 이 기간까지 찾는다 (접수까지 며칠 걸릴 수 있음)
const SEARCH_DAYS_AFTER = 14
const REFINE_TOP = 10 // 상세 API로 습득장소를 받아 지역 점수를 보정할 상위 건수
const MAX_RESULTS = 100
const CACHE_TTL_MS = 10 * 60 * 1000
const CACHE_MAX = 20 // 결과가 최대 100건이라 작다

// "서울 강남구" → LCA000
export function provinceCode(region = '') {
  const first = region.trim().split(/\s+/)[0] ?? ''
  return REGIONS.find((r) => first.startsWith(r.name))?.code
}

/** 조건 → 경찰청 목록 조회 조건 */
export function searchParams(condition, today) {
  const lostTo = condition.dateTo || condition.dateFrom
  const end = addDays(lostTo, SEARCH_DAYS_AFTER) < today ? addDays(lostTo, SEARCH_DAYS_AFTER) : today
  return {
    startYmd: addDays(condition.dateFrom, -1).replaceAll('-', ''),
    endYmd: end.replaceAll('-', ''),
    categoryCode: condition.prdtClCd || categoryCode(majorCategory(condition.prdtClNm ?? '')),
    regionCode: condition.lctCd || provinceCode(condition.region),
  }
}

// 점수 높은 순, 같으면 최근 접수 먼저
const byScore = (a, b) => b.score - a.score || (registrationDate(b) > registrationDate(a) ? 1 : -1)

const toResult = (item, { score, tags }, today) => ({
  atcId: item.atcId,
  fdSn: item.fdSn,
  fdPrdtNm: item.fdPrdtNm,
  prdtClNm: item.prdtClNm,
  clrNm: item.clrNm,
  fdYmd: item.fdYmd,
  depPlace: item.depPlace,
  fdFilePathImg: item.fdFilePathImg,
  score,
  tags,
  isNew: isNewItem(item.fdYmd, today),
})

/**
 * 매칭 결과 (GET /api/lost-items/:id/results)
 * 1) 조건의 분류·지역 코드와 날짜로 경찰청 목록을 훑으며 점수 계산 (40점 미만 제외)
 * 2) 상위 10건은 상세 API로 습득장소(fdPlace)·기관명을 받아 지역 점수 보정
 * 3) 점수순 최대 100건
 */
export function createMatchResultsService({ policeApi, lostItems, now = () => new Date() }) {
  const cache = new Map()

  async function compute(condition) {
    const today = todayKst(now())
    const base = searchParams(condition, today)
    const opts = { sameProvince: Boolean(base.regionCode) }

    let kept = []
    const trim = () => {
      kept = kept.sort(byScore).slice(0, MAX_RESULTS)
    }
    await Promise.all(
      SOURCE_NAMES.map((source) =>
        scanPages(policeApi, source, base, (items) => {
          for (const item of items) {
            const scored = scoreItem(condition, item, opts)
            if (scored.score >= MIN_SCORE) kept.push({ item, ...scored })
          }
          if (kept.length > MAX_RESULTS * 5) trim()
        }),
      ),
    )
    trim()

    // 상위 몇 건은 상세(습득장소)로 지역 점수 다시 계산. 상세 실패는 목록 점수 그대로
    const top = kept.slice(0, REFINE_TOP)
    await Promise.all(
      top.map(async (entry) => {
        try {
          const detail = await policeApi.getFoundItemDetail(entry.item.atcId, entry.item.fdSn)
          if (!detail) return
          Object.assign(entry, scoreItem(condition, { ...entry.item, fdPlace: detail.fdPlace, orgNm: detail.orgNm }, opts))
        } catch {
          // 무시: 보정만 못 할 뿐
        }
      }),
    )
    kept = kept.filter((e) => e.score >= MIN_SCORE).sort(byScore)

    return kept.map((e) => toResult(e.item, e, today))
  }

  /** @returns {Promise<{ condition: object, items: object[] } | null>} 분실물이 없으면 null */
  async function results(lostItemId) {
    const condition = await lostItems.get(lostItemId)
    if (!condition) return null
    const key = `${lostItemId}|${JSON.stringify(condition)}` // 조건을 수정하면 다시 계산
    let hit = cache.get(key)
    if (!hit || hit.expiresAt <= Date.now()) {
      const promise = compute(condition)
      hit = { expiresAt: Date.now() + CACHE_TTL_MS, promise }
      cache.set(key, hit)
      promise.catch(() => cache.delete(key))
      if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value)
    }
    return { condition, items: await hit.promise }
  }

  return { results }
}
