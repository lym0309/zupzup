import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { createFoundItemsService } from '../src/services/foundItems.js'
import { createKakaoLocal } from '../src/services/kakaoLocal.js'
import { createPoliceApi, parseDetailXml, sourceOf } from '../src/services/policeApi.js'

const NOW = () => new Date('2026-11-12T03:00:00Z') // KST 2026-11-12

const DETAIL_XML = `<response><header><resultCode>00</resultCode><resultMsg>NORMAL SERVICE.</resultMsg></header><body><items><item>
<fdPrdtNm>카드지갑</fdPrdtNm><atcId>V0007722L11120002</atcId><fdSn>1</fdSn>
<fdFilePathImg>https://minwon24.police.go.kr/images/sub/img04_no_img.gif</fdFilePathImg>
<fdYmd>2026-11-10</fdYmd><fdHor>21</fdHor><fdPlace>버스</fdPlace><prdtClNm>지갑 &gt; 기타 지갑</prdtClNm>
<depPlace>광남자동차(주)</depPlace><csteSteNm>보관중</csteSteNm><fndKeepOrgnSeNm/><orgId>V0007722</orgId>
<orgNm>광남자동차(주)</orgNm><tel>053-985-5006</tel>
<uniq>광남자동차(주)에서는 [26-11-10]  [카드지갑(에메랄드(선녹)색)]을 습득/보관 하였습니다.&#xd;
방문하시어 보관물품을 수령하시기 바랍니다.&#xd;
&#xd;
특이사항 : 국가공인 자격증</uniq></item></items></body></response>`

const EMPTY_DETAIL_XML =
  '<response><header><resultCode>00</resultCode><resultMsg>NORMAL SERVICE.</resultMsg></header><body><items/></body></response>'

describe('경찰청 상세 API', () => {
  it('parseDetailXml: 필드를 문자열로, uniq의 \\r 제거', () => {
    const item = parseDetailXml(DETAIL_XML)
    expect(item).toMatchObject({
      atcId: 'V0007722L11120002', fdSn: '1', fdHor: '21', fdPlace: '버스', prdtClNm: '지갑 > 기타 지갑',
      csteSteNm: '보관중', fndKeepOrgnSeNm: '', orgNm: '광남자동차(주)', tel: '053-985-5006',
    })
    expect(item.uniq).not.toContain('\r')
  })

  it('parseDetailXml: 없는 관리번호는 null', () => {
    expect(parseDetailXml(EMPTY_DETAIL_XML)).toBeNull()
  })

  it('sourceOf: V로 시작하면 포털기관', () => {
    expect(sourceOf('V0007722L11120002')).toBe('portal')
    expect(sourceOf('F2026111200005435')).toBe('police')
  })

  it('getFoundItemDetail: 출처별 상세 주소로 ATC_ID·FD_SN을 보낸다', async () => {
    const urls = []
    const api = createPoliceApi({
      fetchFn: async (url) => {
        urls.push(new URL(url))
        return new Response(EMPTY_DETAIL_XML)
      },
    })
    await api.getFoundItemDetail('F2026111200005435', '1')
    await api.getFoundItemDetail('V0007722L11120002', '2')
    expect(urls[0].pathname).toMatch(/LosfundInfoInqireService\/getLosfundDetailInfo$/)
    expect(urls[1].pathname).toMatch(/LosPtfundInfoInqireService\/getPtLosfundDetailInfo$/)
    expect(Object.fromEntries(urls[1].searchParams)).toMatchObject({ ATC_ID: 'V0007722L11120002', FD_SN: '2' })
  })
})

describe('foundItems.detail', () => {
  const policeApi = (xml = DETAIL_XML) => {
    let calls = 0
    return {
      get calls() {
        return calls
      },
      async getFoundItemDetail() {
        calls++
        return parseDetailXml(xml)
      },
    }
  }

  it('색상·특이사항을 안내문에서 꺼내고, uniq 원문은 빼고, NEW와 좌표를 붙인다', async () => {
    const kakaoLocal = { searchPlace: async (q) => ({ lat: 35.9, lng: 128.6, placeName: q, address: '대구' }) }
    const svc = createFoundItemsService({ policeApi: policeApi(), kakaoLocal, now: NOW })
    const item = await svc.detail('V0007722L11120002', '1')
    expect(item).toMatchObject({
      clrNm: '에메랄드(선녹)',
      memo: '국가공인 자격증',
      isNew: true,
      location: { lat: 35.9, lng: 128.6, placeName: '광남자동차(주)' },
    })
    expect(item).not.toHaveProperty('uniq')
  })

  it('카카오 키가 없으면 location은 null', async () => {
    const svc = createFoundItemsService({ policeApi: policeApi(), kakaoLocal: createKakaoLocal({ restApiKey: '' }), now: NOW })
    expect((await svc.detail('V0007722L11120002', '1')).location).toBeNull()
  })

  it('없는 관리번호는 null', async () => {
    const svc = createFoundItemsService({ policeApi: policeApi(EMPTY_DETAIL_XML), now: NOW })
    expect(await svc.detail('F1', '1')).toBeNull()
  })

  it('같은 습득물은 캐시해서 다시 호출하지 않는다', async () => {
    const api = policeApi()
    const svc = createFoundItemsService({ policeApi: api, now: NOW })
    await svc.detail('V0007722L11120002', '1')
    await svc.detail('V0007722L11120002', '1')
    expect(api.calls).toBe(1)
  })
})

describe('createKakaoLocal', () => {
  const okResponse = () =>
    Response.json({ documents: [{ x: '128.6', y: '35.9', place_name: '광남자동차', road_address_name: '대구 동구', address_name: '' }] })

  it('키워드 검색 결과 첫 번째를 좌표로, 같은 이름은 캐시', async () => {
    const calls = []
    const kakao = createKakaoLocal({
      restApiKey: 'test-key',
      fetchFn: async (url, opts) => {
        calls.push({ url: new URL(url), auth: opts.headers.Authorization })
        return okResponse()
      },
    })
    expect(await kakao.searchPlace('광남자동차(주)')).toEqual({
      lat: 35.9, lng: 128.6, placeName: '광남자동차', address: '대구 동구',
    })
    await kakao.searchPlace('광남자동차(주)')
    expect(calls).toHaveLength(1)
    expect(calls[0].auth).toBe('KakaoAK test-key')
    expect(calls[0].url.searchParams.get('query')).toBe('광남자동차(주)')
  })

  it('키가 없으면 호출하지 않고 null', async () => {
    let called = false
    const kakao = createKakaoLocal({ restApiKey: '', fetchFn: async () => ((called = true), okResponse()) })
    expect(await kakao.searchPlace('서면지구대')).toBeNull()
    expect(called).toBe(false)
  })

  it('실패하면 null (상세 응답은 막지 않음)', async () => {
    const kakao = createKakaoLocal({ restApiKey: 'k', fetchFn: async () => new Response('x', { status: 401 }) })
    expect(await kakao.searchPlace('서면지구대')).toBeNull()
  })
})

describe('GET /api/found-items/:atcId/:fdSn', () => {
  const app = (detail) => createApp({ pingDb: async () => {}, foundItems: { browse: async () => ({}), detail } })

  it('상세를 돌려준다', async () => {
    const res = await request(app(async (atcId, fdSn) => ({ atcId, fdSn }))).get('/api/found-items/F2026111200005435/1')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ atcId: 'F2026111200005435', fdSn: '1' })
  })

  it('없으면 404', async () => {
    const res = await request(app(async () => null)).get('/api/found-items/F2026111200009999/1')
    expect(res.status).toBe(404)
    expect(res.body.error.message).toContain('찾을 수 없')
  })

  it.each([['f123456', '1'], ['F2026<script>', '1'], ['F2026111200005435', 'abc']])(
    '형식이 틀리면 400 (%s / %s)',
    async (atcId, fdSn) => {
      const res = await request(app(async () => ({}))).get(`/api/found-items/${encodeURIComponent(atcId)}/${fdSn}`)
      expect(res.status).toBe(400)
    },
  )

  it('/filters는 상세 경로와 겹치지 않는다', async () => {
    const res = await request(app(async () => ({}))).get('/api/found-items/filters')
    expect(res.status).toBe(200)
    expect(res.body.categories).toBeDefined()
  })
})
