// 신규 후보 (GET /api/lost-items/:id/new-candidates, 시안 6a/6b) + 본 후보·마지막 확인 기록
// 신규 후보 = 마지막 확인 이후 처음 수집된(first_seen_at) 매칭 결과 중, 본 후보·숨긴 후보를 뺀 것
// - 마지막 확인 기록이 없으면 검색을 등록한 시각 이후를 신규로 본다
// - 조회는 서버 상태를 바꾸지 않는다 (새로고침·중복 요청에도 결과가 같음).
//   마지막 확인 시각은 매칭 결과(1a)를 본 뒤 POST /viewed로, 본 후보는 상세로 들어갈 때 PUT /seen-items로 기록
import { hiddenKey } from '../db/hiddenItemsRepo.js'

const LOCATION_MAX = 30 // 보관장소 좌표를 찾을 최대 건수 (신규 먼저, 다음 이전 결과)

// DB 문자열 'YYYY-MM-DD HH:MM:SS' (KST) → ISO
const toIso = (value) => (value ? `${value.replace(' ', 'T')}+09:00` : null)

/**
 * 매칭 결과를 신규 / 이전 / 숨김으로 나눈다 (순수 함수)
 * @param {{ result: object, firstSeenAt: string|null }[]} entries  점수순
 * @param {{ since: string, seen: Set<string>, hidden: Set<string> }} state  since: DB 시각 문자열
 */
export function splitCandidates(entries, { since, seen, hidden }) {
  const newItems = []
  const previousItems = []
  const hiddenItems = []
  for (const { result, firstSeenAt } of entries) {
    const key = hiddenKey(result.atcId, result.fdSn)
    if (hidden.has(key)) hiddenItems.push({ ...result, isNew: false })
    else if (!seen.has(key) && firstSeenAt && firstSeenAt > since) newItems.push({ ...result, isNew: true })
    else previousItems.push({ ...result, isNew: false })
  }
  return { newItems, previousItems, hiddenItems }
}

/**
 * @param {{ matchResults: { scored: Function },
 *           lostItems: { get: (id: string) => Promise<object> },
 *           seenItems: { markSeen: Function, listKeys: Function, viewState: Function, markViewed: Function },
 *           hiddenItems: { listKeys: (id: string) => Promise<Set<string>> },
 *           lookupCodesRepo: { findByLostItemId: (id: string) => Promise<string|null> },
 *           kakaoLocal?: { searchPlace: (query: string) => Promise<object|null> } | null }} deps
 */
export function createNewCandidatesService({ matchResults, lostItems, seenItems, hiddenItems, lookupCodesRepo, kakaoLocal = null }) {
  async function split(lostItemId) {
    // scored가 분실물 없음(404)·조건 부족(400)을 먼저 확인한다
    const { condition, entries } = await matchResults.scored(lostItemId)
    const [view, seen, hidden] = await Promise.all([
      seenItems.viewState(lostItemId),
      seenItems.listKeys(lostItemId),
      hiddenItems.listKeys(lostItemId),
    ])
    const since = view?.lastViewedAt ?? view?.createdAt ?? ''
    return { condition, view, groups: splitCandidates(entries, { since, seen, hidden }) }
  }

  // 지도 핀용 보관장소 좌표 (키가 없거나 못 찾으면 null)
  async function withLocations(items) {
    return Promise.all(
      items.map(async (item, i) => ({
        ...item,
        location: kakaoLocal && i < LOCATION_MAX ? await kakaoLocal.searchPlace(item.depPlace).catch(() => null) : null,
      })),
    )
  }

  /** GET /api/lost-items/:id/new-candidates */
  async function get(lostItemId) {
    const [{ condition, view, groups }, lookupCode] = await Promise.all([
      split(lostItemId),
      lookupCodesRepo.findByLostItemId(lostItemId),
    ])
    const located = await withLocations([...groups.newItems, ...groups.previousItems])
    return {
      lostItemId,
      condition,
      lookupCode: lookupCode ?? null,
      lastViewedAt: toIso(view?.lastViewedAt ?? null),
      newItems: located.slice(0, groups.newItems.length),
      previousItems: located.slice(groups.newItems.length),
      hiddenItems: groups.hiddenItems.map((item) => ({ ...item, location: null })),
    }
  }

  /** 검색 기록 카드의 "결과 n건 · 새 습득물 n건". 조건이 부족하면 null */
  async function counts(lostItemId) {
    try {
      const { groups } = await split(lostItemId)
      return { resultCount: groups.newItems.length + groups.previousItems.length, newCount: groups.newItems.length }
    } catch (err) {
      if (err.status === 400) return null
      throw err
    }
  }

  /** PUT /api/lost-items/:id/seen-items/:atcId/:fdSn */
  async function markSeen(lostItemId, atcId, fdSn) {
    await lostItems.get(lostItemId) // 없으면 404
    await seenItems.markSeen(lostItemId, atcId, fdSn)
  }

  /** POST /api/lost-items/:id/viewed */
  async function markViewed(lostItemId) {
    await lostItems.get(lostItemId)
    await seenItems.markViewed(lostItemId)
  }

  return { get, counts, markSeen, markViewed }
}
