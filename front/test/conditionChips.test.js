import { describe, expect, it } from 'vitest'
import { conditionChips, dateLabel } from '../src/pages/results/conditionChips.js'

describe('conditionChips', () => {
  it('물품 · 브랜드 · 색상 · 지역 · 날짜 · 특징 순, 빈 값은 뺀다', () => {
    expect(
      conditionChips({
        itemName: '무선이어폰 케이스', brand: '애플', clrNm: '검정', region: '서울 강남구',
        dateFrom: '2026-11-09', dateTo: '2026-11-09', feature: '',
      }),
    ).toEqual(['무선이어폰 케이스', '애플', '검정', '서울 강남구', '11월 9일'])
  })

  it('물품명이 없으면 분류명', () => {
    expect(conditionChips({ prdtClNm: '지갑', dateFrom: '2026-11-01' })).toEqual(['지갑', '11월 1일'])
  })
})

describe('dateLabel', () => {
  it('하루 / 같은 달 범위 / 다른 달 범위', () => {
    expect(dateLabel({ dateFrom: '2026-11-09', dateTo: '2026-11-09' })).toBe('11월 9일')
    expect(dateLabel({ dateFrom: '2026-11-05', dateTo: '2026-11-07' })).toBe('11월 5일~7일')
    expect(dateLabel({ dateFrom: '2026-10-30', dateTo: '2026-11-02' })).toBe('10월 30일~11월 2일')
    expect(dateLabel({})).toBe('')
  })
})
