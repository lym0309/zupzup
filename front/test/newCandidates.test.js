import { describe, expect, it } from 'vitest'
import { formatLastViewed, headerSub, itemId, mapPins, receivedLabel, splitHidden } from '../src/pages/results/newCandidates.js'

const item = (atcId, extra = {}) => ({ atcId, fdSn: '1', fdPrdtNm: atcId, ...extra })

describe('receivedLabel', () => {
  it('오늘 / 어제 / n일 전', () => {
    expect(receivedLabel('2026-11-17', '2026-11-17')).toBe('오늘 접수')
    expect(receivedLabel('2026-11-16', '2026-11-17')).toBe('어제 접수')
    expect(receivedLabel('2026-11-14', '2026-11-17')).toBe('3일 전 접수')
    expect(receivedLabel('2026-10-31', '2026-11-02')).toBe('2일 전 접수') // 달이 넘어가도
  })

  it('접수일을 모르면 null (문구 숨김)', () => {
    expect(receivedLabel(undefined, '2026-11-17')).toBe(null)
  })
})

describe('headerSub', () => {
  it('마지막 확인 날짜 · 조회 코드', () => {
    const lastViewedAt = new Date(2026, 10, 14, 21, 40).toISOString()
    expect(formatLastViewed(lastViewedAt)).toBe('11월 14일')
    expect(headerSub({ lastViewedAt, lookupCode: 'FND-7K2Q-48' })).toBe('마지막 확인 11월 14일 이후 · 조회 코드 FND-7K2Q-48')
  })

  it('없는 값은 빼고', () => {
    expect(headerSub({ lastViewedAt: null, lookupCode: 'FND-7K2Q-48' })).toBe('조회 코드 FND-7K2Q-48')
    expect(headerSub({ lastViewedAt: null, lookupCode: null })).toBe('')
  })
})

describe('splitHidden', () => {
  it('숨긴 습득물(서버 응답 hiddenItems)은 신규·이전에서 빼고 따로 모은다', () => {
    const data = {
      newItems: [item('A'), item('B')],
      previousItems: [item('C'), item('D')],
      hiddenItems: [item('B'), item('D')],
    }
    const result = splitHidden(data)
    expect(result.newItems.map(itemId)).toEqual(['A-1'])
    expect(result.previousItems.map(itemId)).toEqual(['C-1'])
    expect(result.hiddenItems.map(itemId)).toEqual(['B-1', 'D-1'])
  })
})

describe('mapPins', () => {
  it('이전 결과는 previous, 신규는 new 핀. 선택 표시', () => {
    const pins = mapPins(
      { newItems: [item('A', { location: { lat: 37.5, lng: 127 } })], previousItems: [item('C')] },
      'C-1',
    )
    expect(pins).toEqual([
      { id: 'C-1', lat: undefined, lng: undefined, title: 'C', tone: 'previous', selected: true },
      { id: 'A-1', lat: 37.5, lng: 127, title: 'A', tone: 'new', selected: false },
    ])
  })
})
