import { describe, expect, it } from 'vitest'
import {
  applyEdit,
  canSearch,
  chipValue,
  conditionOf,
  dateLabel,
  dateNotice,
  dateRangeError,
  missingFields,
  presetOf,
  presetRange,
  removeField,
  shiftYmd,
  toPatchBody,
  todayKst,
} from '../src/pages/confirm/confirmCondition.js'

const EMPTY = conditionOf({})
const TODAY = '2026-11-17'

describe('todayKst', () => {
  it('한국 시간 기준 날짜 (UTC 15시 = KST 다음 날 0시)', () => {
    expect(todayKst(new Date('2026-11-16T14:59:00Z'))).toBe('2026-11-16')
    expect(todayKst(new Date('2026-11-16T15:00:00Z'))).toBe('2026-11-17')
  })

  it('shiftYmd: 월·연도 경계를 넘는다', () => {
    expect(shiftYmd('2026-11-01', -1)).toBe('2026-10-31')
    expect(shiftYmd('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('칩 값', () => {
  it('날짜: 하루면 날짜 하나, 기간이면 "~"', () => {
    expect(dateLabel({ dateFrom: '2026-11-04', dateTo: '2026-11-04' })).toBe('2026-11-04')
    expect(dateLabel({ dateFrom: '2026-11-03', dateTo: '2026-11-05' })).toBe('2026-11-03 ~ 2026-11-05')
    expect(dateLabel({ dateFrom: null, dateTo: null })).toBeNull()
  })

  it('값이 없으면 null (칩 숨김), 추가 목록에 나온다', () => {
    const c = { ...EMPTY, itemName: '에어팟', dateFrom: TODAY, dateTo: TODAY }
    expect(chipValue('itemName', c)).toBe('에어팟')
    expect(chipValue('brand', c)).toBeNull()
    expect(missingFields(c).map((f) => f.key)).toEqual(['prdtClNm', 'clrNm', 'region', 'brand', 'feature'])
  })
})

describe('applyEdit · removeField', () => {
  it('텍스트는 앞뒤 공백 제거, 비우면 지움', () => {
    expect(applyEdit(EMPTY, 'brand', '  Apple ').brand).toBe('Apple')
    expect(applyEdit({ ...EMPTY, brand: 'Apple' }, 'brand', '   ').brand).toBeNull()
  })

  it('날짜: 끝 날짜를 비우면 시작 날짜 하루', () => {
    expect(applyEdit(EMPTY, 'date', { dateFrom: '2026-11-04', dateTo: '' })).toMatchObject({
      dateFrom: '2026-11-04',
      dateTo: '2026-11-04',
    })
  })

  it('날짜 칩 ✕는 시작·끝 둘 다 지운다', () => {
    const c = removeField({ ...EMPTY, dateFrom: '2026-11-03', dateTo: '2026-11-05' }, 'date')
    expect(c).toMatchObject({ dateFrom: null, dateTo: null })
  })

  it('날짜 범위 오류 (서버와 같은 문구)', () => {
    expect(dateRangeError({ dateFrom: '2026-11-05', dateTo: '2026-11-04' }, TODAY)).toBe('시작 날짜가 끝 날짜보다 늦어요.')
    expect(dateRangeError({ dateFrom: '2026-11-18', dateTo: '' }, TODAY)).toBe('오늘 이후 날짜는 고를 수 없어요.')
    expect(dateRangeError({ dateFrom: '2026-11-04', dateTo: '' }, TODAY)).toBeNull()
  })
})

describe('canSearch', () => {
  it('물품(이름 또는 분류) + 날짜가 있어야 true', () => {
    const date = { dateFrom: TODAY, dateTo: TODAY }
    expect(canSearch({ ...EMPTY, itemName: '지갑', ...date })).toBe(true)
    expect(canSearch({ ...EMPTY, prdtClNm: '지갑', ...date })).toBe(true)
    expect(canSearch({ ...EMPTY, ...date })).toBe(false)
    expect(canSearch({ ...EMPTY, itemName: '지갑' })).toBe(false)
  })
})

describe('dateNotice', () => {
  it('하루 / 기간 / 날짜 없음', () => {
    expect(dateNotice({ dateFrom: '2026-11-04', dateTo: '2026-11-04' })).toBe('2026-11-04에 잃어버린 물건으로 찾아요')
    expect(dateNotice({ dateFrom: '2026-11-03', dateTo: '2026-11-05' })).toBe(
      '2026-11-03 ~ 2026-11-05 사이에 잃어버린 물건으로 찾아요',
    )
    expect(dateNotice(EMPTY)).toBe('물품과 날짜를 정하면 찾아볼 수 있어요')
  })
})

describe('toPatchBody', () => {
  it('조건 필드만, 빈 값은 null (lostItemId·코드는 보내지 않음)', () => {
    const body = toPatchBody({ ...EMPTY, lostItemId: 'x', prdtClCd: 'PRH000', itemName: ' 지갑 ', brand: '' })
    expect(body).toEqual({
      itemName: '지갑',
      prdtClNm: null,
      clrNm: null,
      region: null,
      dateFrom: null,
      dateTo: null,
      brand: null,
      feature: null,
    })
  })
})

describe('3b 날짜 선택지', () => {
  it('오늘 포함 기간으로 바꾼다', () => {
    expect(presetRange('today', TODAY)).toEqual({ dateFrom: TODAY, dateTo: TODAY })
    expect(presetRange('yesterday', TODAY)).toEqual({ dateFrom: '2026-11-16', dateTo: '2026-11-16' })
    expect(presetRange('3d', TODAY)).toEqual({ dateFrom: '2026-11-15', dateTo: TODAY })
    expect(presetRange('7d', TODAY)).toEqual({ dateFrom: '2026-11-11', dateTo: TODAY })
    expect(presetRange('', TODAY)).toEqual({ dateFrom: null, dateTo: null })
  })

  it('저장된 날짜 → 선택지 (없으면 "", 선택지에 없으면 custom)', () => {
    expect(presetOf({ dateFrom: '2026-11-15', dateTo: TODAY }, TODAY)).toBe('3d')
    expect(presetOf({ dateFrom: null, dateTo: null }, TODAY)).toBe('')
    expect(presetOf({ dateFrom: '2026-11-01', dateTo: '2026-11-02' }, TODAY)).toBe('custom')
  })
})
