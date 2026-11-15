import { describe, expect, it } from 'vitest'
import {
  conditionChips,
  dateRangeLabel,
  formatCodeInput,
  formatSearchedAt,
  isValidCode,
} from '../src/pages/history/history.js'

describe('isValidCode', () => {
  it('FND-XXXX-XX 형식만 통과', () => {
    expect(isValidCode('FND-7K2Q-48')).toBe(true)
    expect(isValidCode('FND-7K2Q-4')).toBe(false)
    expect(isValidCode('ABC-7K2Q-48')).toBe(false)
    expect(isValidCode('fnd-7k2q-48')).toBe(false)
  })

  it('헷갈리는 0/O, 1/I는 쓰지 않음', () => {
    expect(isValidCode('FND-0K2Q-48')).toBe(false)
    expect(isValidCode('FND-OK2Q-48')).toBe(false)
    expect(isValidCode('FND-1K2Q-48')).toBe(false)
    expect(isValidCode('FND-IK2Q-48')).toBe(false)
  })
})

describe('formatCodeInput', () => {
  it('자동 대문자 + 하이픈 삽입', () => {
    expect(formatCodeInput('fnd7k2q48')).toBe('FND-7K2Q-48')
    expect(formatCodeInput('fnd-7k2q-48')).toBe('FND-7K2Q-48')
    expect(formatCodeInput(' FND 7K2Q 48 ')).toBe('FND-7K2Q-48')
  })

  it('입력 중간 상태도 자연스럽게', () => {
    expect(formatCodeInput('')).toBe('')
    expect(formatCodeInput('fn')).toBe('FN')
    expect(formatCodeInput('fnd')).toBe('FND')
    expect(formatCodeInput('fnd7')).toBe('FND-7')
    expect(formatCodeInput('fnd7k2q')).toBe('FND-7K2Q')
  })

  it('9자를 넘으면 자름', () => {
    expect(formatCodeInput('FND7K2Q48XYZ')).toBe('FND-7K2Q-48')
  })
})

describe('dateRangeLabel', () => {
  it('하루 / 기간 / 없음', () => {
    expect(dateRangeLabel('2026-11-12', '2026-11-12')).toBe('11.12')
    expect(dateRangeLabel('2026-11-10', '2026-11-12')).toBe('11.10 ~ 11.12')
    expect(dateRangeLabel('2026-11-10', null)).toBe('11.10')
    expect(dateRangeLabel(null, null)).toBe(null)
  })
})

describe('formatSearchedAt', () => {
  it('YYYY.MM.DD HH:mm', () => {
    expect(formatSearchedAt(new Date(2026, 10, 3, 9, 5).toISOString())).toBe('2026.11.03 09:05')
    expect(formatSearchedAt('잘못된 값')).toBe('')
  })
})

describe('conditionChips', () => {
  it('모르는 조건은 숨김', () => {
    expect(
      conditionChips({
        itemName: '우산',
        clrNm: null,
        region: '서울',
        dateFrom: '2026-10-28',
        dateTo: '2026-10-28',
      }),
    ).toEqual(['우산', '서울', '10.28'])
  })
})
