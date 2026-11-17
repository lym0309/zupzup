import { describe, expect, it } from 'vitest'
import { isDeviceId } from '../../src/rules/deviceId.js'
import { CODE_ALPHABET, isLookupCode, lookupCodeFromBytes, normalizeLookupCode } from '../../src/rules/lookupCode.js'

describe('isLookupCode', () => {
  it('FND-XXXX-XX 형식만', () => {
    expect(isLookupCode('FND-7K2Q-48')).toBe(true)
    expect(isLookupCode('FND-7K2Q-4')).toBe(false)
    expect(isLookupCode('ABC-7K2Q-48')).toBe(false)
    expect(isLookupCode('fnd-7k2q-48')).toBe(false)
    expect(isLookupCode(null)).toBe(false)
  })

  it('헷갈리는 0/O, 1/I는 쓰지 않는다', () => {
    for (const c of ['0', 'O', '1', 'I']) expect(isLookupCode(`FND-${c}K2Q-48`)).toBe(false)
  })
})

describe('normalizeLookupCode', () => {
  it('앞뒤 공백 제거 + 대문자', () => {
    expect(normalizeLookupCode(' fnd-7k2q-48 ')).toBe('FND-7K2Q-48')
    expect(normalizeLookupCode(undefined)).toBe('')
  })
})

describe('lookupCodeFromBytes', () => {
  it('바이트 6개 → 항상 형식에 맞는 코드', () => {
    expect(lookupCodeFromBytes(new Uint8Array([0, 1, 2, 3, 4, 5]))).toBe('FND-ABCD-EF')
    expect(lookupCodeFromBytes(new Uint8Array([255, 255, 255, 255, 255, 255]))).toBe('FND-9999-99')
    for (let b = 0; b < 256; b++) expect(isLookupCode(lookupCodeFromBytes(new Uint8Array(6).fill(b)))).toBe(true)
  })

  it('글자표는 32자 (256을 나눠떨어지게 해서 고르게)', () => {
    expect(CODE_ALPHABET).toHaveLength(32)
    expect(new Set(CODE_ALPHABET).size).toBe(32)
  })
})

describe('isDeviceId', () => {
  it('16~64자 영문·숫자·-·_', () => {
    expect(isDeviceId('3f2b8c1e-7a4d-4e9f-b1c2-0d5e6f7a8b9c')).toBe(true)
    expect(isDeviceId('short')).toBe(false)
    expect(isDeviceId('a'.repeat(65))).toBe(false)
    expect(isDeviceId('한글기기아이디한글기기아이디한글기')).toBe(false)
    expect(isDeviceId(undefined)).toBe(false)
  })
})
