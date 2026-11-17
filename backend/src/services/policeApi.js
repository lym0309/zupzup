import { XMLParser } from 'fast-xml-parser'
import { env } from '../config/env.js'

// 경찰청 습득물 OpenAPI 클라이언트 (XML → JSON)
// 출처 두 곳은 파라미터·응답 필드가 같고 주소·오퍼레이션·인증키만 다르다.
//   police: 경찰관서 습득물      (atcId가 F로 시작)
//   portal: 포털기관 습득물 (지하철·공항·대학 등, atcId가 V로 시작)

const SOURCES = {
  police: { config: env.policeApi, listOp: 'getLosfundInfoAccToClAreaPd', detailOp: 'getLosfundDetailInfo' },
  portal: { config: env.portalApi, listOp: 'getPtLosfundInfoAccToClAreaPd', detailOp: 'getPtLosfundDetailInfo' },
}
export const SOURCE_NAMES = Object.keys(SOURCES)

// atcId로 출처 판별 (상세 조회는 출처별로 주소가 다르다)
export const sourceOf = (atcId = '') => (atcId.startsWith('V') ? 'portal' : 'police')

const parser = new XMLParser({
  parseTagValue: false, // atcId·fdSn 등을 문자열 그대로 유지
  trimValues: true,
  isArray: (name) => name === 'item',
})

// 목록 응답에서 화면에 쓰는 필드만 남긴다 (필드명은 API 그대로)
const LIST_FIELDS = ['atcId', 'fdSn', 'fdPrdtNm', 'prdtClNm', 'clrNm', 'fdYmd', 'depPlace', 'fdFilePathImg']
const DETAIL_FIELDS = [
  'atcId', 'fdSn', 'fdPrdtNm', 'prdtClNm', 'fdYmd', 'fdHor', 'fdPlace', 'depPlace', 'fdFilePathImg',
  'csteSteNm', 'fndKeepOrgnSeNm', 'orgId', 'orgNm', 'tel', 'uniq',
]
const pickFields = (fields) => (item) => Object.fromEntries(fields.map((k) => [k, item[k] ?? '']))

export class PoliceApiError extends Error {
  constructor(message) {
    super(message)
    this.name = 'PoliceApiError'
    this.status = 502
  }
}

// 공통: 오류 응답 확인 후 body 반환
function parseBody(xml) {
  const doc = parser.parse(xml)
  // 인증키 오류 등은 OpenAPI_ServiceResponse 형식으로 온다
  const authError = doc.OpenAPI_ServiceResponse?.cmmMsgHeader
  if (authError) {
    throw new PoliceApiError(`경찰청 API 오류: ${authError.returnAuthMsg ?? authError.errMsg}`)
  }
  const header = doc.response?.header
  if (header?.resultCode !== '00') {
    throw new PoliceApiError(`경찰청 API 오류: ${header?.resultMsg ?? '알 수 없는 응답'}`)
  }
  return doc.response.body ?? {}
}

export function parseListXml(xml) {
  const body = parseBody(xml)
  return {
    totalCount: Number(body.totalCount ?? 0),
    items: (body.items?.item ?? []).map(pickFields(LIST_FIELDS)),
  }
}

/** 상세 응답 → 항목 하나 (없으면 null). 줄바꿈의 \r은 지운다 */
export function parseDetailXml(xml) {
  const item = parseBody(xml).items?.item?.[0]
  if (!item) return null
  const picked = pickFields(DETAIL_FIELDS)(item)
  picked.uniq = picked.uniq.replaceAll('\r', '')
  return picked
}

export function createPoliceApi({ fetchFn = fetch, timeoutMs = 30_000 } = {}) {
  async function call(source, op, params) {
    const { config } = SOURCES[source]
    const query = new URLSearchParams({ serviceKey: config.serviceKey, ...params })
    let res
    try {
      res = await fetchFn(`${config.baseUrl}/${SOURCES[source][op]}?${query}`, {
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (err) {
      throw new PoliceApiError(`경찰청 API 호출 실패: ${err.message}`)
    }
    if (!res.ok) throw new PoliceApiError(`경찰청 API 응답 오류: HTTP ${res.status}`)
    return res.text()
  }

  /**
   * 분류·지역·기간으로 습득물 목록 조회 (API 기본 순서: atcId 순)
   * @param {'police'|'portal'} source
   * @param {{ startYmd: string, endYmd: string, categoryCode?: string, regionCode?: string,
   *           pageNo?: number, numOfRows?: number }} params  날짜는 YYYYMMDD
   */
  async function listFoundItems(source, params) {
    const query = {
      START_YMD: params.startYmd,
      END_YMD: params.endYmd,
      pageNo: String(params.pageNo ?? 1),
      numOfRows: String(params.numOfRows ?? 10),
    }
    if (params.categoryCode) query.PRDT_CL_CD_01 = params.categoryCode
    if (params.regionCode) query.N_FD_LCT_CD = params.regionCode
    return parseListXml(await call(source, 'listOp', query))
  }

  /** 습득물 상세 (없으면 null). 출처는 atcId로 판별 */
  async function getFoundItemDetail(atcId, fdSn) {
    return parseDetailXml(await call(sourceOf(atcId), 'detailOp', { ATC_ID: atcId, FD_SN: fdSn }))
  }

  return { listFoundItems, getFoundItemDetail }
}
