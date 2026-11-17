import { hiddenKey } from '../db/hiddenItemsRepo.js'
import { colorFamily } from '../rules/colors.js'
import { colorFromUniq } from '../rules/foundItemDetail.js'
import { majorCategory } from '../rules/foundItemCodes.js'
import { addDays, isNewItem, todayKst } from '../rules/foundItemList.js'
import { MIN_SCORE, scoreItem } from '../rules/score.js'
import { isSearchable } from '../rules/searchCondition.js'

// 습득일은 분실일 하루 전부터, 분실 후 이 기간까지 찾는다 (접수까지 며칠 걸릴 수 있음)
const SEARCH_DAYS_AFTER = 14
const REFINE_TOP = 10 // 습득장소(상세)가 없으면 상세 API로 받아 지역 점수를 보정할 상위 건수
const MAX_RESULTS = 100
const CACHE_TTL_MS = 10 * 60 * 1000
const CACHE_MAX = 50 // 결과가 최대 100건이라 작다

const httpError = (status, message) => Object.assign(new Error(message), { status })

/** 습득일 검색 범위: 분실 하루 전 ~ 분실 후 14일 (오늘까지) */
export function searchWindow(condition, today) {
  const lostTo = condition.dateTo || condition.dateFrom
  const end = addDays(lostTo, SEARCH_DAYS_AFTER)
  return { fromYmd: addDays(condition.dateFrom, -1), toYmd: end < today ? end : today }
}

/** 분류 없이 물품명만 있을 때 DB에서 찾을 키워드 ("무선이어폰 케이스" → ["무선이어폰", "케이스"]) */
export function nameKeywords(itemName = '') {
  return [...new Set((itemName ?? '').split(/\s+/).filter((w) => w.length >= 2))].slice(0, 5)
}

// 점수 높은 순, 같으면 최근 접수 먼저
// 정보 없는 태그는 총점에서 빠지므로, 점수가 같으면 확인된 태그가 많은 쪽(예: 색까지 맞음 > 색 모름)을 위로
const knownTags = (e) => e.tags.filter((t) => t.score !== null).length
const byScore = (a, b) =>
  b.score - a.score ||
  knownTags(b) - knownTags(a) ||
  (b.item.regYmd ?? '').localeCompare(a.item.regYmd ?? '') ||
  b.item.atcId.localeCompare(a.item.atcId)

// 목록 색이 "기타"처럼 색 계열을 모르면 상세 안내문의 색을 쓴다
const unknownColor = (clrNm) => !clrNm || colorFamily(clrNm) === '기타'
const needsDetail = (item) => !item.fdPlace || unknownColor(item.clrNm)

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
 * 1) 수집된 found_items에서 날짜·분류(분류가 없으면 물품명)로 후보를 읽어 점수 계산 (40점 미만 제외)
 * 2) 상위 10건 중 습득장소(상세)를 모르는 건 경찰청 상세 API로 받아 지역 점수 보정
 * 3) 점수순 최대 100건. "내 물건이 아니에요"로 숨긴 습득물은 뺀다
 *
 * @param {{ lostItems: { get: (id: string) => Promise<object> },
 *           candidates: { find: (q: object) => Promise<object[]> },
 *           hiddenItems: { hide: Function, unhide: Function, listKeys: (id: string) => Promise<Set<string>> },
 *           policeApi?: { getFoundItemDetail: Function }, now?: () => Date }} deps
 */
export function createMatchResultsService({ lostItems, candidates, hiddenItems, policeApi = null, now = () => new Date() }) {
  const cache = new Map()

  async function compute(condition) {
    const today = todayKst(now())
    const category = condition.prdtClNm ? majorCategory(condition.prdtClNm) : null
    const rows = await candidates.find({
      ...searchWindow(condition, today),
      category,
      nameKeywords: category ? [] : nameKeywords(condition.itemName),
    })

    let kept = []
    for (const item of rows) {
      const scored = scoreItem(condition, item)
      if (scored.score >= MIN_SCORE) kept.push({ item, ...scored })
    }
    kept = kept.sort(byScore).slice(0, MAX_RESULTS)

    // 상위 몇 건은 상세(습득장소·안내문 색)로 지역·색 점수 다시 계산. 상세 실패는 목록 점수 그대로
    if (policeApi) {
      await Promise.all(
        kept
          .slice(0, REFINE_TOP)
          .filter((e) => needsDetail(e.item))
          .map(async (entry) => {
            try {
              const detail = await policeApi.getFoundItemDetail(entry.item.atcId, entry.item.fdSn)
              if (!detail) return
              const detailColor = colorFromUniq(detail.uniq)
              entry.item = {
                ...entry.item,
                fdPlace: detail.fdPlace,
                orgNm: detail.orgNm,
                clrNm: unknownColor(entry.item.clrNm) && !unknownColor(detailColor) ? detailColor : entry.item.clrNm,
              }
              Object.assign(entry, scoreItem(condition, entry.item))
            } catch {
              // 무시: 보정만 못 할 뿐
            }
          }),
      )
      kept = kept.filter((e) => e.score >= MIN_SCORE).sort(byScore)
    }

    return kept.map((e) => toResult(e.item, e, today))
  }

  // 분실물이 없으면 404 (lostItems.get이 던짐)
  async function searchableCondition(lostItemId) {
    const condition = await lostItems.get(lostItemId)
    if (!isSearchable(condition)) throw httpError(400, '물품과 잃어버린 날짜를 먼저 정해 주세요.')
    return condition
  }

  /** @returns {Promise<{ condition: object, items: object[] }>} */
  async function results(lostItemId) {
    const condition = await searchableCondition(lostItemId)
    const key = `${lostItemId}|${JSON.stringify(condition)}` // 조건을 수정하면 다시 계산
    let hit = cache.get(key)
    if (!hit || hit.expiresAt <= Date.now()) {
      const promise = compute(condition)
      hit = { expiresAt: Date.now() + CACHE_TTL_MS, promise }
      cache.set(key, hit)
      promise.catch(() => cache.delete(key))
      if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value)
    }
    // 숨긴 목록은 바로 반영되도록 캐시 밖에서 뺀다
    const [items, hidden] = await Promise.all([hit.promise, hiddenItems.listKeys(lostItemId)])
    return { condition, items: items.filter((it) => !hidden.has(hiddenKey(it.atcId, it.fdSn))) }
  }

  /** "내 물건이 아니에요" / 숨기기 취소 */
  async function hide(lostItemId, atcId, fdSn) {
    await lostItems.get(lostItemId)
    await hiddenItems.hide(lostItemId, atcId, fdSn)
  }
  async function unhide(lostItemId, atcId, fdSn) {
    await lostItems.get(lostItemId)
    await hiddenItems.unhide(lostItemId, atcId, fdSn)
  }

  return { results, hide, unhide }
}
