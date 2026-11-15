import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'
import { createHistoryService } from '../src/services/history.js'
import { createLookupCodesService } from '../src/services/lookupCodes.js'
import { createLostItemsService } from '../src/services/lostItems.js'

const NOW = () => new Date('2026-11-14T03:00:00Z')
const DEVICE = '3f2b8c1e-7a4d-4e9f-b1c2-0d5e6f7a8b9c'
const OTHER_DEVICE = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

// DB 대신 메모리에 저장
function memoryRepos() {
  const lostItems = new Map()
  const codes = new Map() // code → lostItemId
  const history = [] // { deviceId, lostItemId, searchedAt }
  let clock = 0

  const lostItemsRepo = {
    insert: async (item) => void lostItems.set(item.id, { ...item }),
    findById: async (id) => (lostItems.has(id) ? { ...lostItems.get(id) } : null),
    updateCondition: async () => {},
  }
  const codeOf = (lostItemId) => [...codes].find(([, id]) => id === lostItemId)?.[0] ?? null
  const lookupCodesRepo = {
    findByLostItemId: async (lostItemId) => codeOf(lostItemId),
    findByCode: async (code) => codes.get(code) ?? null,
    insert: vi.fn(async (code, lostItemId) => {
      if (!codes.has(code) && !codeOf(lostItemId)) codes.set(code, lostItemId)
      return codeOf(lostItemId)
    }),
  }
  const historyRepo = {
    upsert: async (deviceId, lostItemId) => {
      const searchedAt = `2026-11-14T12:00:0${clock++}+09:00`
      const row = history.find((h) => h.deviceId === deviceId && h.lostItemId === lostItemId)
      if (row) row.searchedAt = searchedAt
      else history.push({ deviceId, lostItemId, searchedAt })
    },
    listByDevice: async (deviceId) =>
      history
        .filter((h) => h.deviceId === deviceId)
        .sort((a, b) => b.searchedAt.localeCompare(a.searchedAt))
        .map((h) => ({ lostItem: lostItems.get(h.lostItemId), lookupCode: codeOf(h.lostItemId), searchedAt: h.searchedAt })),
    deleteByDevice: async (deviceId) => {
      const before = history.length
      history.splice(0, history.length, ...history.filter((h) => h.deviceId !== deviceId))
      return before - history.length
    },
  }
  return { lostItemsRepo, lookupCodesRepo, historyRepo, codes }
}

function setup({ newCode } = {}) {
  const repos = memoryRepos()
  let n = 0
  const ids = ['aaaaaaaaaaaaaaa1', 'aaaaaaaaaaaaaaa2', 'aaaaaaaaaaaaaaa3']
  const lostItems = createLostItemsService({ repo: repos.lostItemsRepo, now: NOW, newId: () => ids[n++], log: () => {} })
  const lookupCodes = createLookupCodesService({ repo: repos.lookupCodesRepo, lostItemsRepo: repos.lostItemsRepo, newCode })
  const history = createHistoryService({ repo: repos.historyRepo, lookupCodes })
  return { ...repos, app: createApp({ lostItems, lookupCodes, history }) }
}

const register = (app, rawText, deviceId = DEVICE) => {
  const req = request(app).post('/api/lost-items')
  if (deviceId) req.set('X-Device-Id', deviceId)
  return req.send({ rawText })
}

describe('검색 기록 저장 (POST /api/lost-items + X-Device-Id)', () => {
  it('분실물을 등록하면 그 기기의 기록에 추가되고 조회 코드가 발급된다', async () => {
    const { app } = setup()
    const created = await register(app, '버스에서 지갑을 잃어버렸어요')
    expect(created.status).toBe(201)

    const res = await request(app).get('/api/history').set('X-Device-Id', DEVICE)
    expect(res.status).toBe(200)
    expect(res.body.items).toHaveLength(1)
    expect(res.body.items[0]).toMatchObject({
      condition: { lostItemId: created.body.lostItemId, rawText: '버스에서 지갑을 잃어버렸어요' },
      searchedAt: '2026-11-14T12:00:00+09:00',
      resultCount: null,
      newCount: 0,
    })
    expect(res.body.items[0].lookupCode).toMatch(/^FND-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{2}$/)
  })

  it('기기 헤더가 없거나 이상하면 등록만 하고 기록은 안 남긴다', async () => {
    const { app } = setup()
    expect((await register(app, '버스에서 지갑을 잃어버렸어요', null)).status).toBe(201)
    expect((await register(app, '카페에서 우산을 잃어버렸어요', 'bad')).status).toBe(201)
    const res = await request(app).get('/api/history').set('X-Device-Id', DEVICE)
    expect(res.body.items).toEqual([])
  })
})

describe('GET /api/history', () => {
  it('최근 검색 순, 다른 기기의 기록은 안 보인다', async () => {
    const { app } = setup()
    await register(app, '버스에서 지갑을 잃어버렸어요')
    await register(app, '카페에서 우산을 잃어버렸어요')
    await register(app, '지하철에서 이어폰을 잃어버렸어요', OTHER_DEVICE)

    const res = await request(app).get('/api/history').set('X-Device-Id', DEVICE)
    expect(res.body.items.map((i) => i.condition.rawText)).toEqual(['카페에서 우산을 잃어버렸어요', '버스에서 지갑을 잃어버렸어요'])
  })

  it('기기 헤더가 없으면 400', async () => {
    const res = await request(setup().app).get('/api/history')
    expect(res.status).toBe(400)
    expect(res.body.error.message).toContain('기기 정보')
  })
})

describe('DELETE /api/history', () => {
  it('이 기기 기록만 지우고, 조회 코드로는 여전히 열 수 있다', async () => {
    const { app } = setup()
    await register(app, '버스에서 지갑을 잃어버렸어요')
    await register(app, '지하철에서 이어폰을 잃어버렸어요', OTHER_DEVICE)
    const { lookupCode } = (await request(app).get('/api/history').set('X-Device-Id', DEVICE)).body.items[0]

    const res = await request(app).delete('/api/history').set('X-Device-Id', DEVICE)
    expect(res.body).toEqual({ deleted: 1 })
    expect((await request(app).get('/api/history').set('X-Device-Id', DEVICE)).body.items).toEqual([])
    expect((await request(app).get('/api/history').set('X-Device-Id', OTHER_DEVICE)).body.items).toHaveLength(1)
    expect((await request(app).get(`/api/lookup-codes/${lookupCode}`)).status).toBe(200)
  })
})

describe('POST /api/lookup-codes', () => {
  it('발급하면 { code, lostItemId }, 다시 발급해도 같은 코드', async () => {
    const { app } = setup()
    const { lostItemId } = (await register(app, '버스에서 지갑을 잃어버렸어요', null)).body

    const first = await request(app).post('/api/lookup-codes').send({ lostItemId })
    const second = await request(app).post('/api/lookup-codes').send({ lostItemId })
    expect(first.status).toBe(200)
    expect(first.body).toEqual({ code: expect.stringMatching(/^FND-/), lostItemId })
    expect(second.body).toEqual(first.body)
  })

  it('다른 분실물이 쓰는 코드와 겹치면 새 코드로 다시 시도', async () => {
    const queue = ['FND-AAAA-AA', 'FND-AAAA-AA', 'FND-BBBB-BB']
    const { app, lookupCodesRepo } = setup({ newCode: () => queue.shift() })
    const a = (await register(app, '버스에서 지갑을 잃어버렸어요')).body.lostItemId
    const b = (await register(app, '카페에서 우산을 잃어버렸어요')).body.lostItemId

    expect((await request(app).post('/api/lookup-codes').send({ lostItemId: a })).body.code).toBe('FND-AAAA-AA')
    expect((await request(app).post('/api/lookup-codes').send({ lostItemId: b })).body.code).toBe('FND-BBBB-BB')
    expect(lookupCodesRepo.insert).toHaveBeenCalledTimes(3)
  })

  it('없는 분실물이면 404', async () => {
    const { app } = setup()
    for (const body of [{ lostItemId: 'zzzzzzzzzzzzzzzz' }, { lostItemId: 'bad' }, {}]) {
      expect((await request(app).post('/api/lookup-codes').send(body)).status).toBe(404)
    }
  })
})

describe('GET /api/lookup-codes/:code', () => {
  it('코드 → lostItemId. 소문자로 보내도 찾는다', async () => {
    const { app } = setup()
    const { lostItemId } = (await register(app, '버스에서 지갑을 잃어버렸어요')).body
    const { code } = (await request(app).post('/api/lookup-codes').send({ lostItemId })).body

    const res = await request(app).get(`/api/lookup-codes/${code.toLowerCase()}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ code, lostItemId })
  })

  it('형식이 틀리면 400, 없는 코드면 404', async () => {
    const { app } = setup()
    const bad = await request(app).get('/api/lookup-codes/FND-0000-00')
    expect(bad.status).toBe(400)
    expect(bad.body.error.message).toBe('조회 코드는 FND-XXXX-XX 형식이에요')

    const missing = await request(app).get('/api/lookup-codes/FND-ZZZZ-ZZ')
    expect(missing.status).toBe(404)
    expect(missing.body.error.message).toBe('이 조회 코드로 저장된 검색이 없어요.')
  })
})
