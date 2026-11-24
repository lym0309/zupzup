import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { hiddenKey } from '../src/db/hiddenItemsRepo.js'
import { buildCandidatesQuery, fromRow } from '../src/db/matchCandidatesRepo.js'
import { nameKeywords } from '../src/rules/score.js'
import { createMatchResultsService, searchWindow } from '../src/services/matchResults.js'

const NOW = () => new Date('2026-11-12T03:00:00Z') // KST 2026-11-12
const ID = 'nyMw1pywIlWaR12w' // lostItemId 형식 (무작위 16자)

// GET /api/lost-items/:id 응답 모양 (#29)
const condition = {
  lostItemId: ID,
  rawText: '서울에서 검정 에어팟을 잃어버렸어요',
  extracted: true,
  itemName: '에어팟',
  prdtClNm: '전자기기',
  prdtClCd: 'PRG000',
  clrNm: '검정',
  region: '서울',
  lctCd: 'LCA000',
  dateFrom: '2026-11-08',
  dateTo: '2026-11-08',
  brand: null,
  feature: null,
}

// found_items에서 읽은 후보 (matchCandidatesRepo.fromRow 모양)
const item = (atcId, extra = {}) => ({
  atcId, fdSn: '1', fdPrdtNm: '에어팟', prdtClNm: '전자기기 > 무선이어폰', clrNm: '블랙(검정)',
  fdYmd: '2026-11-09', regYmd: '2026-11-09', depPlace: '용강지구대', fdFilePathImg: 'no_img',
  region: '서울', fdPlace: '', orgNm: '', ...extra,
})

const notFound = () => Object.assign(new Error('분실물을 찾을 수 없어요.'), { status: 404 })

function fakeDeps({ cond = condition, rows = [], details = {} } = {}) {
  const calls = { find: [], detail: [] }
  const hidden = new Set()
  return {
    calls,
    hidden,
    lostItems: { get: async (id) => (id === cond.lostItemId ? cond : Promise.reject(notFound())) },
    candidates: {
      async find(q) {
        calls.find.push(q)
        return rows
      },
    },
    hiddenItems: {
      hide: async (id, a, s) => void hidden.add(hiddenKey(a, s)),
      unhide: async (id, a, s) => void hidden.delete(hiddenKey(a, s)),
      listKeys: async () => new Set(hidden),
    },
    policeApi: {
      async getFoundItemDetail(atcId) {
        calls.detail.push(atcId)
        return details[atcId] ?? null
      },
    },
  }
}

const service = (deps) => createMatchResultsService({ ...deps, now: NOW })

describe('검색 범위·키워드', () => {
  it('searchWindow: 분실 하루 전 ~ 분실 후 14일 (오늘까지)', () => {
    expect(searchWindow(condition, '2026-11-12')).toEqual({ fromYmd: '2026-11-07', toYmd: '2026-11-12' })
    expect(searchWindow({ dateFrom: '2026-10-01', dateTo: '2026-10-02' }, '2026-11-12')).toEqual({
      fromYmd: '2026-09-30', toYmd: '2026-10-16',
    })
  })

  it('nameKeywords: 공백으로 나누고 2글자 이상, 중복 제거', () => {
    expect(nameKeywords('무선이어폰 케이스 케이스 a')).toEqual(['무선이어폰', '케이스'])
    expect(nameKeywords(null)).toEqual([])
  })
})

describe('matchCandidatesRepo', () => {
  it('보관 중(gone_at IS NULL)이고 습득일 범위·분류로 고른다', () => {
    const { sql, params } = buildCandidatesQuery({ fromYmd: '2026-11-07', toYmd: '2026-11-12', category: '전자기기' })
    expect(sql).toContain('gone_at IS NULL')
    expect(sql).toContain('category = ?')
    expect(sql).toMatch(/ORDER BY reg_ymd DESC/)
    expect(params).toEqual(['2026-11-07', '2026-11-12', '전자기기'])
  })

  it('분류와 물품명이 다 있으면 분류로 고르고, 물품명이 들어간 것을 먼저 읽는다 (최대 줄 수에 걸려도 남게)', () => {
    const { sql, params } = buildCandidatesQuery({ fromYmd: 'a', toYmd: 'b', category: '전자기기', nameKeywords: ['에어팟'] })
    expect(sql).toMatch(/WHERE gone_at IS NULL AND fd_ymd BETWEEN \? AND \? AND category = \?\s+ORDER BY/)
    expect(sql).toMatch(/ORDER BY \(fd_prdt_nm LIKE \?\) DESC, reg_ymd DESC/)
    expect(params).toEqual(['a', 'b', '전자기기', '%에어팟%'])
  })

  it('분류가 없으면 물품명 키워드 LIKE (특수문자는 글자 그대로)', () => {
    const { sql, params } = buildCandidatesQuery({ fromYmd: 'a', toYmd: 'b', nameKeywords: ['에어팟', '100%'] })
    expect(sql).toContain('(fd_prdt_nm LIKE ? OR fd_prdt_nm LIKE ?)')
    expect(params.slice(2)).toEqual(['%에어팟%', '%100\\%%'])
  })

  it('fromRow: 테이블 컬럼 → 목록 API 필드명', () => {
    expect(
      fromRow({
        atc_id: 'F1', fd_sn: '1', fd_prdt_nm: '지갑', prdt_cl_nm: '지갑 > 남성용 지갑', clr_nm: '블랙(검정)',
        fd_ymd: '2026-11-09', reg_ymd: '2026-11-10', dep_place: '서면지구대', img_url: 'x', region: '부산',
        detail_fd_place: null, detail_org_nm: null, first_seen_at: '2026-11-10 09:00:00',
      }),
    ).toEqual({
      atcId: 'F1', fdSn: '1', fdPrdtNm: '지갑', prdtClNm: '지갑 > 남성용 지갑', clrNm: '블랙(검정)',
      fdYmd: '2026-11-09', regYmd: '2026-11-10', depPlace: '서면지구대', fdFilePathImg: 'x', region: '부산',
      fdPlace: '', orgNm: '', firstSeenAt: '2026-11-10 09:00:00',
    })
  })
})

describe('matchResults.scored', () => {
  it('숨긴 것까지 점수순 전체 + 처음 수집한 시각 (신규 후보 판정용)', async () => {
    const deps = fakeDeps({ rows: [item('F1', { firstSeenAt: '2026-11-10 09:00:00' }), item('F2')] })
    deps.hidden.add(hiddenKey('F1', '1'))
    const { entries } = await service(deps).scored(ID)
    // 점수가 같으면 atcId 역순 → F2, F1
    expect(entries.map((e) => [e.result.atcId, e.firstSeenAt])).toEqual([['F2', null], ['F1', '2026-11-10 09:00:00']])
  })
})

describe('matchResults.results', () => {
  it('점수순으로 돌려주고 40점 미만은 뺀다', async () => {
    const deps = fakeDeps({
      rows: [
        item('F1'), // 분류·색상·지역 일치, 다음 날 → 높음
        item('F2', { clrNm: '레드(빨강)', fdYmd: '2026-11-11' }), // 색상 불일치, 3일 뒤
        item('F3', { prdtClNm: '지갑 > 남성용 지갑', clrNm: '레드(빨강)', fdYmd: '2026-11-07', region: '부산' }), // 거의 불일치
      ],
    })
    const { condition: c, items } = await service(deps).results(ID)

    expect(c).toEqual(condition)
    expect(items.map((r) => r.atcId)).toEqual(['F1', 'F2'])
    expect(items.every((r) => r.score >= 40)).toBe(true)
    expect(items[0].tags).toEqual([
      { key: 'category', score: 100 }, // 대분류만 골랐으므로 대분류 일치 = 100
      { key: 'color', score: 100 },
      { key: 'date', score: 95 },
      { key: 'region', score: 100 }, // 시·도만 골랐고 같은 시·도
    ])
    expect(items.find((r) => r.atcId === 'F2').isNew).toBe(true) // 11-11
    expect(items[0]).not.toHaveProperty('region') // 응답은 MatchResult 필드만 (+ 접수일)
    expect(items[0]).not.toHaveProperty('firstSeenAt')
    expect(items[0].regYmd).toBe('2026-11-09')
  })

  it('조건의 분류·물품명 키워드와 습득일 범위로 후보를 찾는다', async () => {
    const deps = fakeDeps()
    await service(deps).results(ID)
    expect(deps.calls.find[0]).toEqual({ fromYmd: '2026-11-07', toYmd: '2026-11-12', category: '전자기기', nameKeywords: ['에어팟'] })

    const noCategory = fakeDeps({ cond: { ...condition, prdtClNm: null, itemName: '에어팟 프로' } })
    await service(noCategory).results(ID)
    expect(noCategory.calls.find[0]).toMatchObject({ category: null, nameKeywords: ['에어팟', '프로'] })
  })

  it('습득장소를 모르는 상위 결과는 상세 API로 지역 점수 보정 (구·역 키워드)', async () => {
    const deps = fakeDeps({
      cond: { ...condition, region: '서울 강남구' },
      rows: [item('F1')],
      details: { F1: { fdPlace: '강남구 역삼동 카페', orgNm: '용강지구대' } },
    })
    const { items } = await service(deps).results(ID)
    expect(items[0].tags.find((t) => t.key === 'region').score).toBe(100)
    expect(deps.calls.detail).toEqual(['F1'])
  })

  it('상세가 이미 저장돼 있으면 상세 API를 부르지 않는다. 상세 실패는 목록 점수 그대로', async () => {
    const saved = fakeDeps({ rows: [item('F1', { fdPlace: '택시' })] })
    await service(saved).results(ID)
    expect(saved.calls.detail).toEqual([])

    const failing = fakeDeps({ cond: { ...condition, region: '서울 강남구' }, rows: [item('F1')] })
    failing.policeApi.getFoundItemDetail = async () => {
      throw new Error('down')
    }
    const { items } = await service(failing).results(ID)
    expect(items[0].tags.find((t) => t.key === 'region').score).toBe(60) // 같은 시·도
  })

  it('점수가 같으면 확인된 태그가 많은 쪽이 위 (색까지 맞음 > 색 모름)', async () => {
    // F9가 atcId로는 먼저지만 색이 "기타"라 색 점수가 빠진 채 같은 점수 (습득일·지역 모두 일치)
    const cond = { ...condition, dateTo: '2026-11-09' }
    const rows = [item('F9', { clrNm: '기타', fdPlace: '택시' }), item('F1', { fdPlace: '택시' })]
    const deps = fakeDeps({ cond, rows })
    const { items } = await service(deps).results(ID)
    expect(items.map((it) => [it.atcId, it.score])).toEqual([['F1', 100], ['F9', 100]])
  })

  it('목록 색이 "기타"면 상세 안내문의 색으로 색 점수 보정', async () => {
    const uniq = '[2026.11.09]  [에어팟(블랙(검정)색)]을 습득/보관 하였습니다.'
    const deps = fakeDeps({
      rows: [item('F1', { clrNm: '기타', fdPlace: '택시' })],
      details: { F1: { fdPlace: '택시', orgNm: '용강지구대', uniq } },
    })
    const { items } = await service(deps).results(ID)
    expect(deps.calls.detail).toEqual(['F1'])
    expect(items[0].clrNm).toBe('블랙(검정)')
    expect(items[0].tags.find((t) => t.key === 'color').score).toBe(100)
  })

  it('물품이나 날짜가 없으면 400, 없는 분실물은 404', async () => {
    const noDate = fakeDeps({ cond: { ...condition, dateFrom: null, dateTo: null } })
    await expect(service(noDate).results(ID)).rejects.toMatchObject({ status: 400 })
    const noItem = fakeDeps({ cond: { ...condition, itemName: null, prdtClNm: null } })
    await expect(service(noItem).results(ID)).rejects.toMatchObject({ status: 400 })
    await expect(service(fakeDeps()).results('AAAAAAAAAAAAAAAA')).rejects.toMatchObject({ status: 404 })
  })

  it('숨긴 습득물은 빼고, 숨기기 취소하면 다시 보인다 (캐시와 상관없이 바로)', async () => {
    const deps = fakeDeps({ rows: [item('F1'), item('F2')] })
    const svc = service(deps)
    // 점수·접수일이 같으면 관리번호 큰 것(나중 접수) 먼저
    expect((await svc.results(ID)).items.map((r) => r.atcId)).toEqual(['F2', 'F1'])

    await svc.hide(ID, 'F1', '1')
    expect((await svc.results(ID)).items.map((r) => r.atcId)).toEqual(['F2'])
    await svc.unhide(ID, 'F1', '1')
    expect((await svc.results(ID)).items.map((r) => r.atcId)).toEqual(['F2', 'F1'])
    expect(deps.calls.find).toHaveLength(1) // 결과는 캐시
  })

  it('없는 분실물은 숨길 수 없다 (404)', async () => {
    await expect(service(fakeDeps()).hide('AAAAAAAAAAAAAAAA', 'F1', '1')).rejects.toMatchObject({ status: 404 })
  })

  it('조건을 수정하면 다시 계산한다', async () => {
    const deps = fakeDeps({ rows: [item('F1')] })
    const svc = service(deps)
    await svc.results(ID)
    deps.lostItems.get = async () => ({ ...condition, clrNm: '흰색' })
    await svc.results(ID)
    expect(deps.calls.find).toHaveLength(2)
  })
})

describe('라우트', () => {
  const app = (matchResults) => createApp({ pingDb: async () => {}, matchResults })

  it('GET /api/lost-items/:id/results', async () => {
    const res = await request(app({ results: async (id) => ({ condition: { lostItemId: id }, items: [] }) })).get(
      `/api/lost-items/${ID}/results`,
    )
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ condition: { lostItemId: ID }, items: [] })
  })

  it('서비스 오류 상태 그대로 (404·400), 형식 오류 400', async () => {
    const fail = (status) => app({ results: async () => Promise.reject(Object.assign(new Error('x'), { status })) })
    expect((await request(fail(404)).get(`/api/lost-items/${ID}/results`)).status).toBe(404)
    expect((await request(fail(400)).get(`/api/lost-items/${ID}/results`)).status).toBe(400)
    expect((await request(fail(404)).get('/api/lost-items/a%20b/results')).status).toBe(400)
  })

  it('PUT·DELETE /api/lost-items/:id/hidden-items/:atcId/:fdSn → 204', async () => {
    const calls = []
    const svc = {
      hide: async (...a) => void calls.push(['hide', ...a]),
      unhide: async (...a) => void calls.push(['unhide', ...a]),
    }
    expect((await request(app(svc)).put(`/api/lost-items/${ID}/hidden-items/F2026111200005435/1`)).status).toBe(204)
    expect((await request(app(svc)).delete(`/api/lost-items/${ID}/hidden-items/V0007722L11120002/1`)).status).toBe(204)
    expect(calls).toEqual([
      ['hide', ID, 'F2026111200005435', '1'],
      ['unhide', ID, 'V0007722L11120002', '1'],
    ])
  })

  it('관리번호 형식이 틀리면 400', async () => {
    const svc = { hide: async () => {} }
    expect((await request(app(svc)).put(`/api/lost-items/${ID}/hidden-items/f123/1`)).status).toBe(400)
    expect((await request(app(svc)).put(`/api/lost-items/${ID}/hidden-items/F2026111200005435/x`)).status).toBe(400)
  })
})
