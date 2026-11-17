import { describe, expect, it } from 'vitest'
import { rateLimit } from '../src/middlewares/rateLimit.js'

function run(mw, ip) {
  let error = null
  const headers = {}
  mw({ ip }, { set: (k, v) => (headers[k] = v) }, (err) => (error = err ?? null))
  return { error, headers }
}

describe('rateLimit', () => {
  it('구간 안에서 max번까지 통과, 넘으면 429', () => {
    let t = 0
    const mw = rateLimit({ max: 2, windowMs: 1000, now: () => t })
    expect(run(mw, 'a').error).toBe(null)
    expect(run(mw, 'a').error).toBe(null)
    const blocked = run(mw, 'a')
    expect(blocked.error.status).toBe(429)
    expect(blocked.headers['Retry-After']).toBe('1')
  })

  it('IP마다 따로 세고, 구간이 지나면 다시 통과', () => {
    let t = 0
    const mw = rateLimit({ max: 1, windowMs: 1000, now: () => t })
    run(mw, 'a')
    expect(run(mw, 'a').error.status).toBe(429)
    expect(run(mw, 'b').error).toBe(null)
    t = 1000
    expect(run(mw, 'a').error).toBe(null)
  })
})
