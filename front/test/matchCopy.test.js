import { describe, expect, it } from 'vitest'
import { dayGap, headline, subCopy, tagNote, tagStatus, withIjiman, withRo } from '../src/shared/matchCopy.js'

const condition = { region: '서울', dateFrom: '2026-11-05', dateTo: '2026-11-05' }
const item = { prdtClNm: '전자기기 > 무선이어폰', clrNm: '블랙(검정)', fdYmd: '2026-11-07' }
const ctx = { condition, item }
const t = (category, color, date, region) => [
  { key: 'category', score: category },
  { key: 'color', score: color },
  { key: 'date', score: date },
  { key: 'region', score: region },
]

describe('규칙표 1번: tagStatus', () => {
  it.each([[100, 'match'], [80, 'match'], [79, 'partial'], [50, 'partial'], [49, 'mismatch'], [0, 'mismatch'], [null, 'unknown'], [undefined, 'unknown']])(
    '%s → %s',
    (score, status) => expect(tagStatus(score)).toBe(status),
  )
})

describe('규칙표 2번: headline', () => {
  it('종합 점수 구간', () => {
    expect(headline(92)).toBe('입력하신 조건과 대부분 일치해요')
    expect(headline(80)).toBe('입력하신 조건과 대부분 일치해요')
    expect(headline(79)).toBe('일부 조건이 달라요')
    expect(headline(60)).toBe('일부 조건이 달라요')
    expect(headline(59)).toBe('몇 가지 조건만 비슷해요')
    expect(headline(40)).toBe('몇 가지 조건만 비슷해요')
    expect(headline(39)).toBeNull()
  })
})

describe('규칙표 3번: subCopy (가장 낮은 조건 하나)', () => {
  it('모두 80 이상이면 생략', () => {
    expect(subCopy(t(100, 90, 85, 80), ctx)).toBe('')
  })

  it('가장 낮은 조건을 설명한다', () => {
    expect(subCopy(t(100, 100, 95, 60), ctx)).toBe('서울 안이지만 잃어버린 장소와 떨어져 있어요')
    expect(subCopy(t(100, 100, 95, 30), ctx)).toBe('잃어버린 지역과 다른 곳에서 접수됐어요')
    expect(subCopy(t(100, 60, 95, 90), ctx)).toBe('색상이 검정으로 등록돼 있어요. 비슷한 색인지 확인해 주세요')
    expect(subCopy(t(100, 10, 95, 90), ctx)).toBe('색상이 검정으로 달라요')
    expect(subCopy(t(55, 100, 95, 90), ctx)).toBe('같은 전자기기지만 세부 종류가 달라요')
    expect(subCopy(t(0, 100, 95, 90), ctx)).toBe('물품 종류가 전자기기로 달라요')
  })

  it('날짜: 뒤에 접수 / 먼저 습득', () => {
    expect(subCopy(t(100, 100, 60, 90), ctx)).toBe('잃어버린 날보다 2일 뒤에 접수됐어요')
    expect(subCopy(t(100, 100, 60, 90), { condition, item: { ...item, fdYmd: '2026-11-02' } })).toBe(
      '잃어버린 날보다 3일 먼저 습득된 물건이에요',
    )
  })

  it('점수가 같으면 지역 → 날짜 → 색상 → 분류 순', () => {
    expect(subCopy(t(60, 60, 60, 60), ctx)).toContain('잃어버린 장소')
    expect(subCopy(t(60, 60, 60, 90), ctx)).toContain('뒤에 접수')
    expect(subCopy(t(60, 60, 90, 90), ctx)).toContain('색상이')
  })

  it('정보 없는 조건은 건너뛴다', () => {
    expect(subCopy(t(100, null, 95, 90), ctx)).toBe('')
    expect(subCopy([], ctx)).toBe('')
  })
})

describe('규칙표 4번: tagNote', () => {
  it('분류', () => {
    expect(tagNote({ key: 'category', score: 100 }, ctx)).toBe('무선이어폰')
    expect(tagNote({ key: 'category', score: 55 }, ctx)).toBe('같은 전자기기')
    expect(tagNote({ key: 'category', score: 0 }, ctx)).toBe('다른 분류')
  })

  it('색상 (괄호 안 표기만)', () => {
    expect(tagNote({ key: 'color', score: 100 }, ctx)).toBe('검정')
    expect(tagNote({ key: 'color', score: 60 }, ctx)).toBe('비슷한 색')
    expect(tagNote({ key: 'color', score: 10 }, ctx)).toBe('다른 색')
  })

  it('날짜', () => {
    expect(tagNote({ key: 'date', score: 100 }, { condition, item: { ...item, fdYmd: '2026-11-05' } })).toBe('잃어버린 당일')
    expect(tagNote({ key: 'date', score: 95 }, { condition, item: { ...item, fdYmd: '2026-11-06' } })).toBe('잃어버린 다음 날')
    expect(tagNote({ key: 'date', score: 70 }, ctx)).toBe('2일 차이')
    expect(tagNote({ key: 'date', score: 20 }, ctx)).toBe('2일 이상 차이')
  })

  it('지역 · 정보 없음', () => {
    expect(tagNote({ key: 'region', score: 90 }, ctx)).toBe('같은 장소')
    expect(tagNote({ key: 'region', score: 60 }, ctx)).toBe('같은 서울 다른 곳')
    expect(tagNote({ key: 'region', score: 10 }, ctx)).toBe('다른 지역')
    expect(tagNote({ key: 'region', score: null }, ctx)).toBe('정보 없음')
  })
})

describe('도우미', () => {
  it('dayGap: 분실 기간 안이면 0', () => {
    expect(dayGap({ dateFrom: '2026-11-01', dateTo: '2026-11-05' }, '2026-11-03')).toBe(0)
    expect(dayGap({ dateFrom: '2026-11-01', dateTo: '2026-11-05' }, '2026-11-07')).toBe(2)
    expect(dayGap({ dateFrom: '2026-11-01', dateTo: '2026-11-05' }, '2026-10-30')).toBe(-2)
    expect(dayGap({}, '2026-11-03')).toBeNull()
  })

  it('조사: 받침에 맞춰', () => {
    expect(withRo('검정')).toBe('검정으로')
    expect(withRo('보라')).toBe('보라로')
    expect(withRo('카드')).toBe('카드로')
    expect(withRo('지갑')).toBe('지갑으로')
    expect(withRo('귀금속')).toBe('귀금속으로')
    expect(withRo('흰')).toBe('흰으로')
    expect(withRo('은')).toBe('은으로')
    expect(withRo('휴대폰')).toBe('휴대폰으로')
    expect(withRo('기타물품')).toBe('기타물품으로')
    expect(withRo('달')).toBe('달로') // ㄹ 받침
    expect(withIjiman('지갑')).toBe('지갑이지만')
    expect(withIjiman('의류')).toBe('의류지만')
  })
})
