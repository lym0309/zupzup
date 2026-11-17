import { afterEach, describe, expect, it, vi } from 'vitest'
import { deviceHeaders, getDeviceId, newId } from '../src/shared/deviceId.js'

const DEVICE_ID = /^[A-Za-z0-9_-]{16,64}$/ // 백엔드 rules/deviceId.js와 같은 기준

afterEach(() => vi.unstubAllGlobals())

describe('newId', () => {
  it('randomUUID가 있으면 UUID', () => {
    expect(newId()).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('randomUUID가 없으면(HTTP + IP 접속) getRandomValues로 32자', () => {
    vi.stubGlobal('crypto', { getRandomValues: (arr) => arr.fill(171) })
    expect(newId()).toBe('ab'.repeat(16))
    expect(newId()).toMatch(DEVICE_ID)
  })
})

describe('getDeviceId', () => {
  it('localStorage에 저장하고 다음에도 같은 값', () => {
    const store = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, v),
    })
    const id = getDeviceId()
    expect(id).toMatch(DEVICE_ID)
    expect(getDeviceId()).toBe(id)
    expect(deviceHeaders()).toEqual({ 'X-Device-Id': id })
  })

  it('저장된 값이 이상하면 새로 만든다', () => {
    const store = new Map([['zupzup.deviceId', 'bad']])
    vi.stubGlobal('localStorage', { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) })
    expect(getDeviceId()).toMatch(DEVICE_ID)
  })

  it('localStorage를 못 써도 오류 없이 이 탭에서 같은 값', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
    })
    const id = getDeviceId()
    expect(id).toMatch(DEVICE_ID)
    expect(getDeviceId()).toBe(id)
  })
})
