import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { createMockLostItems } from '../src/mocks/lostItems.js'
import { createMatchResultsService, provinceCode, searchParams } from '../src/services/matchResults.js'

const NOW = () => new Date('2026-11-12T03:00:00Z') // KST 2026-11-12

const condition = {
  lostItemId: 'lost-1',
  prdtClNm: '전자기기 > 무선이어폰',
  clrNm: '검정',
  region: '서울 강남구',
  dateFrom: '2026-11-08',
  dateTo: '2026-11-08',
}

const item = (atcId, extra = {}) => ({
  atcId, fdSn: '1', fdPrdtNm: '에어팟', prdtClNm: '전자기기 > 무선이어폰', clrNm: '블랙(검정)',
  fdYmd: '2026-11-09', depPlace: '용강지구대', fdFilePathImg: 'no_img', ...extra,
})

function fakePoliceApi({ police = [], portal = [], details = {} } = {}) {
  const calls = { list: [], detail: [] }
  return {
    calls,
    async listFoundItems(source, params) {
      calls.list.push({ source, ...params })
      const all = { police, portal }[source]
      const start = (params.pageNo - 1) * params.numOfRows
      return { totalCount: all.length, items: all.slice(start, start + params.numOfRows) }
    },
    async getFoundItemDetail(atcId) {
      calls.detail.push(atcId)
      return details[atcId] ?? null
    },
  }
}

const lostItems = (c = condition) => ({ get: async (id) => (id === c.lostItemId ? c : null) })

describe('searchParams', () => {
  it('분류·지역 코드와 습득일 범위 (분실 하루 전 ~ 분실 후 14일, 오늘까지)', () => {
    expect(searchParams(condition, '2026-11-12')).toEqual({
      startYmd: '20261107', endYmd: '20261112', categoryCode: 'PRG000', regionCode: 'LCA000',
    })
    expect(searchParams({ ...condition, dateFrom: '2026-10-01', dateTo: '2026-10-02' }, '2026-11-12').endYmd).toBe('20261016')
  })

  it('코드가 있으면 그대로 쓴다', () => {
    expect(searchParams({ ...condition, prdtClCd: 'PRH000', lctCd: 'LCV000' }, '2026-11-12')).toMatchObject({
      categoryCode: 'PRH000', regionCode: 'LCV000',
    })
  })

  it('provinceCode', () => {
    expect(provinceCode('서울 강남구')).toBe('LCA000')
    expect(provinceCode('서울특별시')).toBe('LCA000')
    expect(provinceCode('어딘가')).toBeUndefined()
  })
})

describe('matchResults.results', () => {
  it('점수순으로 돌려주고 40점 미만은 뺀다', async () => {
    const api = fakePoliceApi({
      police: [
        item('F1'), // 분류·색상 일치, 다음 날, 같은 시·도 → 높음
        item('F2', { clrNm: '레드(빨강)', fdYmd: '2026-11-11' }), // 색상 불일치, 3일 뒤
        item('F3', { prdtClNm: '지갑 > 남성용 지갑', clrNm: '레드(빨강)', fdYmd: '2026-11-07' }), // 거의 불일치
      ],
      portal: [item('V0000001L11090001', { depPlace: '강남역 유실물센터' })], // 지역 키워드 일치 → 가장 높음
    })
    const svc = createMatchResultsService({ policeApi: api, lostItems: lostItems(), now: NOW })
    const { condition: c, items } = await svc.results('lost-1')

    expect(c).toEqual(condition)
    expect(items.map((r) => r.atcId)).toEqual(['V0000001L11090001', 'F1', 'F2'])
    expect(items.every((r) => r.score >= 40)).toBe(true)
    expect(items[0]).toMatchObject({ isNew: false, tags: expect.any(Array), score: expect.any(Number) }) // 11-09: 3일 전
    expect(items.find((r) => r.atcId === 'F2').isNew).toBe(true) // 11-11
    expect(items[0].tags.find((t) => t.key === 'region').score).toBe(100)
  })

  it('상위 결과는 상세의 습득장소로 지역 점수를 보정한다', async () => {
    const api = fakePoliceApi({
      police: [item('F1')],
      details: { F1: { fdPlace: '강남구 역삼동 카페', orgNm: '용강지구대' } },
    })
    const svc = createMatchResultsService({ policeApi: api, lostItems: lostItems(), now: NOW })
    const { items } = await svc.results('lost-1')
    expect(items[0].tags.find((t) => t.key === 'region').score).toBe(100)
    expect(api.calls.detail).toEqual(['F1'])
  })

  it('상세 조회가 실패해도 목록 점수로 결과를 돌려준다', async () => {
    const api = fakePoliceApi({ police: [item('F1')] })
    api.getFoundItemDetail = async () => {
      throw new Error('down')
    }
    const svc = createMatchResultsService({ policeApi: api, lostItems: lostItems(), now: NOW })
    const { items } = await svc.results('lost-1')
    expect(items).toHaveLength(1)
    expect(items[0].tags.find((t) => t.key === 'region').score).toBe(60)
  })

  it('조건의 분류·지역 코드와 날짜로 경찰청을 조회한다', async () => {
    const api = fakePoliceApi()
    const svc = createMatchResultsService({ policeApi: api, lostItems: lostItems(), now: NOW })
    await svc.results('lost-1')
    expect(api.calls.list[0]).toMatchObject({ categoryCode: 'PRG000', regionCode: 'LCA000', startYmd: '20261107', endYmd: '20261112' })
  })

  it('같은 분실물은 캐시, 없는 분실물은 null', async () => {
    const api = fakePoliceApi({ police: [item('F1')] })
    const svc = createMatchResultsService({ policeApi: api, lostItems: lostItems(), now: NOW })
    await svc.results('lost-1')
    const before = api.calls.list.length
    await svc.results('lost-1')
    expect(api.calls.list.length).toBe(before)
    expect(await svc.results('nope')).toBeNull()
  })
})

describe('mock 분실물 (lostItems)', () => {
  it('데모 조건은 오늘 기준 날짜', async () => {
    const store = createMockLostItems({ now: NOW })
    const demo = await store.get('demo')
    expect(demo).toMatchObject({ lostItemId: 'demo', dateFrom: '2026-11-09', prdtClNm: '전자기기 > 무선이어폰' })
    expect(await store.get('없는id')).toBeNull()
  })
})

describe('GET /api/lost-items/:id/results', () => {
  const app = (results) => createApp({ pingDb: async () => {}, matchResults: { results } })

  it('조건과 결과를 돌려준다', async () => {
    const res = await request(app(async (id) => ({ condition: { lostItemId: id }, items: [] }))).get('/api/lost-items/demo/results')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ condition: { lostItemId: 'demo' }, items: [] })
  })

  it('없는 분실물 404, 형식 오류 400', async () => {
    expect((await request(app(async () => null)).get('/api/lost-items/nope/results')).status).toBe(404)
    expect((await request(app(async () => null)).get('/api/lost-items/a%20b/results')).status).toBe(400)
  })
})
