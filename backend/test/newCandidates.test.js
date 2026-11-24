import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'
import { hiddenKey } from '../src/db/hiddenItemsRepo.js'
import { createHistoryService } from '../src/services/history.js'
import { createNewCandidatesService, splitCandidates } from '../src/services/newCandidates.js'

const ID = 'nyMw1pywIlWaR12w'
const DEVICE = '3f2b8c1e-7a4d-4e9f-b1c2-0d5e6f7a8b9c'
const condition = { lostItemId: ID, itemName: '에어팟', prdtClNm: '전자기기', dateFrom: '2026-11-08', dateTo: '2026-11-08' }

// matchResults.scored 결과 한 건 (점수순)
const entry = (atcId, firstSeenAt, extra = {}) => ({
  result: {
    atcId, fdSn: '1', fdPrdtNm: '에어팟', prdtClNm: '전자기기 > 무선이어폰', clrNm: '블랙(검정)',
    fdYmd: '2026-11-09', regYmd: '2026-11-10', depPlace: '용강지구대', fdFilePathImg: 'x',
    score: 90, tags: [], isNew: false, ...extra,
  },
  firstSeenAt,
})

const httpError = (status) => Object.assign(new Error(`HTTP ${status}`), { status })

function fakeDeps({
  entries = [],
  view = { lastViewedAt: null, createdAt: '2026-11-08 20:00:00' },
  cond = condition,
  places = {},
} = {}) {
  const seen = new Set()
  const hidden = new Set()
  const state = { view: { ...view }, viewedCalls: 0 }
  const exists = (id) => (id === ID ? cond : Promise.reject(httpError(404)))
  return {
    seen,
    hidden,
    state,
    matchResults: {
      scored: vi.fn(async (id) => {
        await exists(id)
        if (!cond.dateFrom) throw httpError(400)
        return { condition: cond, entries }
      }),
    },
    lostItems: { get: async (id) => exists(id) },
    seenItems: {
      markSeen: async (id, a, s) => void seen.add(hiddenKey(a, s)),
      listKeys: async () => new Set(seen),
      viewState: async () => state.view,
      markViewed: async () => {
        state.viewedCalls++
        state.view.lastViewedAt = '2026-11-12 09:00:00'
      },
    },
    hiddenItems: { listKeys: async () => new Set(hidden) },
    lookupCodesRepo: { findByLostItemId: async () => 'FND-7K2Q-48' },
    kakaoLocal: { searchPlace: vi.fn(async (q) => places[q] ?? null) },
  }
}

const service = (deps) => createNewCandidatesService(deps)
const ids = (items) => items.map((it) => it.atcId)

describe('splitCandidates', () => {
  it('기준 시각 이후 처음 수집된 것만 신규, 본 후보는 이전, 숨긴 후보는 따로 (점수순 유지)', () => {
    const entries = [
      entry('F1', '2026-11-11 10:00:00'), // 신규
      entry('F2', '2026-11-09 10:00:00'), // 기준 이전 → 이전 결과
      entry('F3', '2026-11-11 11:00:00'), // 신규지만 본 후보 → 이전 결과
      entry('F4', '2026-11-11 12:00:00'), // 숨김
      entry('F5', '2026-11-11 13:00:00'), // 신규
    ]
    const { newItems, previousItems, hiddenItems } = splitCandidates(entries, {
      since: '2026-11-10 00:00:00',
      seen: new Set([hiddenKey('F3', '1')]),
      hidden: new Set([hiddenKey('F4', '1')]),
    })
    expect(ids(newItems)).toEqual(['F1', 'F5'])
    expect(ids(previousItems)).toEqual(['F2', 'F3'])
    expect(ids(hiddenItems)).toEqual(['F4'])
    expect(newItems.every((it) => it.isNew)).toBe(true)
    expect([...previousItems, ...hiddenItems].some((it) => it.isNew)).toBe(false)
  })

  it('수집 시각을 모르면 신규가 아니다', () => {
    const { newItems } = splitCandidates([entry('F1', null)], { since: '', seen: new Set(), hidden: new Set() })
    expect(newItems).toEqual([])
  })
})

describe('newCandidates.get', () => {
  it('마지막 확인 이후 새로 들어온 후보 + 이전 결과 + 숨긴 후보, 조회 코드·좌표', async () => {
    const deps = fakeDeps({
      entries: [entry('F1', '2026-11-12 10:00:00'), entry('F2', '2026-11-10 10:00:00')],
      view: { lastViewedAt: '2026-11-11 21:40:00', createdAt: '2026-11-08 20:00:00' },
      places: { 용강지구대: { lat: 37.5, lng: 126.9, placeName: '용강지구대', address: '서울' } },
    })
    const body = await service(deps).get(ID)

    expect(body).toMatchObject({
      lostItemId: ID,
      condition,
      lookupCode: 'FND-7K2Q-48',
      lastViewedAt: '2026-11-11T21:40:00+09:00',
      hiddenItems: [],
    })
    expect(ids(body.newItems)).toEqual(['F1'])
    expect(ids(body.previousItems)).toEqual(['F2'])
    expect(body.newItems[0]).toMatchObject({ isNew: true, regYmd: '2026-11-10', location: { lat: 37.5, lng: 126.9 } })
  })

  it('확인한 적이 없으면 검색 등록 시각 이후를 신규로 본다 (lastViewedAt: null)', async () => {
    const deps = fakeDeps({ entries: [entry('F1', '2026-11-09 10:00:00'), entry('F2', '2026-11-08 19:00:00')] })
    const body = await service(deps).get(ID)
    expect(body.lastViewedAt).toBeNull()
    expect(ids(body.newItems)).toEqual(['F1'])
    expect(ids(body.previousItems)).toEqual(['F2'])
  })

  it('조회는 상태를 바꾸지 않는다 (두 번 불러도 같음)', async () => {
    const deps = fakeDeps({ entries: [entry('F1', '2026-11-12 10:00:00')] })
    const svc = service(deps)
    const first = await svc.get(ID)
    expect(await svc.get(ID)).toEqual(first)
    expect(deps.state.viewedCalls).toBe(0)
  })

  it('본 후보는 다음 조회부터 이전 결과로, 마지막 확인 후에는 신규가 사라진다', async () => {
    const deps = fakeDeps({ entries: [entry('F1', '2026-11-11 10:00:00'), entry('F2', '2026-11-11 11:00:00')] })
    const svc = service(deps)

    await svc.markSeen(ID, 'F1', '1')
    let body = await svc.get(ID)
    expect(ids(body.newItems)).toEqual(['F2'])
    expect(ids(body.previousItems)).toEqual(['F1'])

    await svc.markViewed(ID) // 2026-11-12 09:00
    body = await svc.get(ID)
    expect(body.newItems).toEqual([])
    expect(body.lastViewedAt).toBe('2026-11-12T09:00:00+09:00')
  })

  it('좌표는 키가 없으면(kakaoLocal 없음) null', async () => {
    const deps = fakeDeps({ entries: [entry('F1', '2026-11-12 10:00:00')] })
    const body = await createNewCandidatesService({ ...deps, kakaoLocal: null }).get(ID)
    expect(body.newItems[0].location).toBeNull()
  })

  it('없는 분실물 404, 물품·날짜가 없으면 400', async () => {
    await expect(service(fakeDeps()).get('aaaaaaaaaaaaaaaa')).rejects.toMatchObject({ status: 404 })
    await expect(service(fakeDeps({ cond: { ...condition, dateFrom: null } })).get(ID)).rejects.toMatchObject({ status: 400 })
  })
})

describe('newCandidates.counts (검색 기록)', () => {
  it('결과 수(숨긴 것 제외)와 새 후보 수', async () => {
    const deps = fakeDeps({
      entries: [entry('F1', '2026-11-12 10:00:00'), entry('F2', '2026-11-08 10:00:00'), entry('F3', '2026-11-12 11:00:00')],
    })
    deps.hidden.add(hiddenKey('F3', '1'))
    expect(await service(deps).counts(ID)).toEqual({ resultCount: 2, newCount: 1 })
  })

  it('조건이 부족하면 null', async () => {
    expect(await service(fakeDeps({ cond: { ...condition, dateFrom: null } })).counts(ID)).toBeNull()
  })

  it('history.list에 채워진다. 계산이 실패하면 resultCount null · newCount 0', async () => {
    const row = (id) => ({ lostItem: { id, rawText: '에어팟', extracted: true }, lookupCode: null, searchedAt: 'x' })
    const repo = { listByDevice: async () => [row('a'), row('b')] }
    const counts = async (id) => {
      if (id === 'b') throw new Error('db down')
      return { resultCount: 5, newCount: 2 }
    }
    const history = createHistoryService({ repo, lookupCodes: {}, counts, log: () => {} })
    const { items } = await history.list(DEVICE)
    expect(items.map((it) => [it.resultCount, it.newCount])).toEqual([[5, 2], [null, 0]])
  })
})

describe('라우트', () => {
  const setup = (opts) => {
    const deps = fakeDeps(opts)
    return { deps, app: createApp({ newCandidates: service(deps) }) }
  }

  it('GET /api/lost-items/:id/new-candidates', async () => {
    const { app } = setup({ entries: [entry('F1', '2026-11-12 10:00:00')] })
    const res = await request(app).get(`/api/lost-items/${ID}/new-candidates`)
    expect(res.status).toBe(200)
    expect(ids(res.body.newItems)).toEqual(['F1'])
  })

  it('PUT seen-items → 204, 여러 번 보내도 같음', async () => {
    const { app, deps } = setup()
    for (let i = 0; i < 2; i++) {
      const res = await request(app).put(`/api/lost-items/${ID}/seen-items/F2026111200005435/1`)
      expect(res.status).toBe(204)
    }
    expect([...deps.seen]).toEqual(['F2026111200005435:1'])
  })

  it('POST viewed → 204', async () => {
    const { app, deps } = setup()
    expect((await request(app).post(`/api/lost-items/${ID}/viewed`)).status).toBe(204)
    expect(deps.state.viewedCalls).toBe(1)
  })

  it('형식이 틀리면 400, 없는 분실물 404', async () => {
    const { app } = setup()
    expect((await request(app).put(`/api/lost-items/${ID}/seen-items/bad!/1`)).status).toBe(400)
    expect((await request(app).post('/api/lost-items/aaaaaaaaaaaaaaaa/viewed')).status).toBe(404)
  })
})
