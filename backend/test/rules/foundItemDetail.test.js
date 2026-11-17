import { describe, expect, it } from 'vitest'
import { colorFromUniq, memoFromUniq } from '../../src/rules/foundItemDetail.js'

// 실제 경찰청 상세 응답의 안내문 (2026-11)
const POLICE_UNIQ = `내용

 오송파출소에서는 [2026.11.12]  [샤넬반지갑(분홍색), 금색 가드링 등(레드(연한레드)색)]을 습득/보관 하였습니다.
분실하신 분께서는 본인을 증명할 수 있는 서류를 지참하시어 보관중으로 기재되어 있는 기관에
방문하시어 보관물품을 수령하시기 바랍니다.

특이사항 : 없음`

const PORTAL_UNIQ = `광남자동차(주)에서는 [26-11-10]  [카드지갑(에메랄드(선녹)색)]을 습득/보관 하였습니다.
방문하시어 보관물품을 수령하시기 바랍니다.

특이사항 : 국가공인 자격증`

describe('colorFromUniq', () => {
  it('안내문의 "(색상색)]을 습득"에서 색상명을 꺼낸다', () => {
    expect(colorFromUniq(POLICE_UNIQ)).toBe('레드(연한레드)') // 물품명 안의 괄호에 속지 않는다
    expect(colorFromUniq(PORTAL_UNIQ)).toBe('에메랄드(선녹)')
  })

  it('괄호 없는 색상명', () => {
    expect(colorFromUniq('[우산(기타색)]을 습득/보관 하였습니다.')).toBe('기타')
  })

  it('형식이 다르면 빈 문자열', () => {
    expect(colorFromUniq('')).toBe('')
    expect(colorFromUniq('보관 중입니다')).toBe('')
  })
})

describe('memoFromUniq', () => {
  it('"특이사항 :" 뒤 텍스트', () => {
    expect(memoFromUniq(PORTAL_UNIQ)).toBe('국가공인 자격증')
  })

  it('"없음"이거나 없으면 빈 문자열', () => {
    expect(memoFromUniq(POLICE_UNIQ)).toBe('')
    expect(memoFromUniq('특이사항 :')).toBe('')
    expect(memoFromUniq('')).toBe('')
  })

  it('여러 줄이면 그대로 둔다', () => {
    expect(memoFromUniq('특이사항 : 신분증 2장\n카드 1장')).toBe('신분증 2장\n카드 1장')
  })
})
