// 검색 기록 · 조회 코드 mock (백엔드 GET /api/history, GET /api/lookup-codes/:code 가 생기면 삭제)
// "전체 삭제"가 새로고침 후에도 유지되도록 기기(localStorage)에 저장한다

const STORAGE_KEY = 'zupzup.mock.history'

/**
 * @typedef {Object} HistoryEntry
 * @property {import('../shared/types.js').SearchCondition} condition
 * @property {string} lookupCode     조회 코드 FND-XXXX-XX
 * @property {string} searchedAt     검색 시각 (ISO)
 * @property {number} resultCount    매칭 결과 수
 * @property {number} newCount       마지막 조회 이후 새 후보 수
 */

/** @type {HistoryEntry[]} */
const SEED = [
  {
    condition: {
      lostItemId: 'mock-1',
      rawText: '어제 저녁 2호선 강남역에서 흰색 무선이어폰 케이스를 잃어버렸어요',
      extracted: true,
      itemName: '무선이어폰 케이스',
      prdtClNm: '전자기기',
      clrNm: '흰색',
      region: '서울',
      dateFrom: '2026-11-12',
      dateTo: '2026-11-13',
    },
    lookupCode: 'FND-7K2Q-48',
    searchedAt: '2026-11-13T21:40:00+09:00',
    resultCount: 12,
    newCount: 3,
  },
  {
    condition: {
      lostItemId: 'mock-2',
      rawText: '지난주 버스에서 검정 가죽 지갑을 두고 내렸어요',
      extracted: true,
      itemName: '가죽 지갑',
      prdtClNm: '지갑',
      clrNm: '검정',
      region: '경기',
      dateFrom: '2026-11-03',
      dateTo: '2026-11-07',
    },
    lookupCode: 'FND-M3XR-25',
    searchedAt: '2026-11-08T09:15:00+09:00',
    resultCount: 7,
    newCount: 0,
  },
  {
    condition: {
      lostItemId: 'mock-3',
      rawText: '카페에서 우산을 잃어버렸어요',
      extracted: true,
      itemName: '우산',
      prdtClNm: null,
      clrNm: null,
      region: null,
      dateFrom: '2026-10-28',
      dateTo: '2026-10-28',
    },
    lookupCode: 'FND-H8PW-93',
    searchedAt: '2026-10-28T18:02:00+09:00',
    resultCount: 2,
    newCount: 1,
  },
]

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms))

function load() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : SEED
  } catch {
    return SEED
  }
}

function save(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // 저장이 막힌 브라우저: 이번 화면에서만 반영
  }
}

export async function mockGetHistory() {
  await delay()
  return { items: load() }
}

export async function mockClearHistory() {
  await delay()
  save([])
}

/** 조회 코드 → lostItemId. 다른 기기 검색도 열려야 하므로 기록 삭제와 무관하게 SEED에서 찾는다 */
export async function mockLookupCode(code) {
  await delay()
  const entry = SEED.find((e) => e.lookupCode === code)
  return entry ? { lostItemId: entry.condition.lostItemId } : null
}
