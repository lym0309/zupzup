import { describe, expect, it, vi } from 'vitest'
import {
  buildInstruction,
  createGeminiExtractor,
  normalizeDates,
  parseResponse,
  RESPONSE_SCHEMA,
  withWeekday,
} from '../src/services/llm.js'

const TODAY = '2026-11-25'
const CONDITION = {
  itemName: '에어팟 프로 케이스', prdtClNm: '전자기기', clrNm: '검정', region: '서울',
  dateFrom: '2026-11-24', dateTo: '2026-11-24', brand: 'Apple', feature: '케이스만',
}

// Gemini generateContent 응답 모양
const geminiBody = (value) => ({
  candidates: [{ content: { parts: [{ text: JSON.stringify(value) }], role: 'model' }, finishReason: 'STOP' }],
})
const ok = (body) => ({ ok: true, status: 200, json: async () => body })
const fail = (status) => ({ ok: false, status, json: async () => ({ error: { code: status } }) })

const extractorWith = (fetchFn, opts = {}) =>
  createGeminiExtractor({ apiKey: 'test-key', models: ['m1', 'm2'], fetchFn, log: () => {}, ...opts })

describe('createGeminiExtractor', () => {
  it('키가 없으면 호출하지 않고 null (→ 3b)', async () => {
    const fetchFn = vi.fn()
    const extract = createGeminiExtractor({ apiKey: '', fetchFn })
    expect(await extract('어제 지갑 잃어버렸어요', { today: TODAY })).toBeNull()
    expect(fetchFn).not.toHaveBeenCalled()
    expect(extract.enabled).toBe(false)
  })

  it('모델·키·문장·오늘 날짜·응답 스키마를 담아 요청하고, 응답 JSON을 돌려준다', async () => {
    const fetchFn = vi.fn(async () => ok(geminiBody(CONDITION)))
    const result = await extractorWith(fetchFn)('어제 2호선에서 검정 에어팟 프로 케이스', { today: TODAY })

    expect(result).toEqual(CONDITION)
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/m1:generateContent')
    expect(init.headers['x-goog-api-key']).toBe('test-key')
    const body = JSON.parse(init.body)
    expect(body.contents[0].parts[0].text).toBe('어제 2호선에서 검정 에어팟 프로 케이스')
    expect(body.systemInstruction.parts[0].text).toContain('오늘은 2026-11-25(수)')
    expect(body.generationConfig).toMatchObject({ responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA })
  })

  it('앞 모델이 실패(503 과부하 등)하면 다음 모델로', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(fail(503)).mockResolvedValueOnce(ok(geminiBody(CONDITION)))
    expect(await extractorWith(fetchFn)('문장', { today: TODAY })).toEqual(CONDITION)
    expect(fetchFn.mock.calls.map(([url]) => url.match(/models\/(\w+):/)[1])).toEqual(['m1', 'm2'])
  })

  it('목록을 한 번 더 돌고도 실패하면 오류 (→ lostItems가 3b로 처리)', async () => {
    const fetchFn = vi.fn(async () => fail(503))
    await expect(extractorWith(fetchFn)('문장', { today: TODAY })).rejects.toThrow('Gemini 추출 실패 (HTTP 503)')
    expect(fetchFn).toHaveBeenCalledTimes(4)
  })

  it('전체 제한 시간이 지나면 더 시도하지 않는다', async () => {
    let t = 0
    const fetchFn = vi.fn(async () => {
      t += 700 // 요청마다 0.7초 걸린다고 가정
      return fail(503)
    })
    await expect(extractorWith(fetchFn, { timeoutMs: 1000, now: () => t })('문장', { today: TODAY })).rejects.toThrow()
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })
})

describe('parseResponse', () => {
  it('여러 part로 나뉜 텍스트를 합치고, 생각(thought) part는 뺀다', () => {
    const body = {
      candidates: [{ content: { parts: [{ text: '생각 중', thought: true }, { text: '{"itemName":' }, { text: '"지갑"}' }] } }],
    }
    expect(parseResponse(body)).toEqual({ itemName: '지갑' })
  })

  it('답이 없거나(차단 등) 객체가 아니면 오류', () => {
    expect(() => parseResponse({ candidates: [{ finishReason: 'SAFETY' }] })).toThrow('SAFETY')
    expect(() => parseResponse({ promptFeedback: { blockReason: 'OTHER' } })).toThrow('OTHER')
    expect(() => parseResponse(geminiBody(['지갑']))).toThrow('객체가 아님')
    expect(() => parseResponse({ candidates: [{ content: { parts: [{ text: '지갑' }] } }] })).toThrow()
  })
})

describe('normalizeDates', () => {
  it('날짜가 하나만 있으면 그 하루로', () => {
    expect(normalizeDates({ dateFrom: '2026-11-20', dateTo: null })).toEqual({ dateFrom: '2026-11-20', dateTo: '2026-11-20' })
    expect(normalizeDates({ dateFrom: null, dateTo: '2026-11-20' })).toEqual({ dateFrom: '2026-11-20', dateTo: '2026-11-20' })
    expect(normalizeDates({ dateFrom: null, dateTo: null })).toEqual({ dateFrom: null, dateTo: null })
  })
})

describe('프롬프트 · 스키마', () => {
  it('요일을 붙인 오늘 날짜', () => {
    expect(withWeekday('2026-11-25')).toBe('2026-11-25(수)')
    expect(withWeekday('2026-11-29')).toBe('2026-11-29(일)')
  })

  it('분류·색상·지역은 서버 목록과 같은 값만 고르게 한다', () => {
    const { prdtClNm, clrNm, region } = RESPONSE_SCHEMA.properties
    expect(prdtClNm.enum).toContain('전자기기')
    expect(clrNm.enum).toContain('검정')
    expect(region.enum).toContain('서울')
    expect(buildInstruction(TODAY)).toContain('분류 목록: 가방, 도서용품')
  })
})
