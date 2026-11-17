// IP당 요청 수 제한 (메모리, 고정 구간). 서버 한 대 기준이라 서버를 다시 켜면 초기화된다
// 조회 코드 무작위 대입으로 남의 분실물 원문을 보는 것을 막는 용도
// (app.js의 trust proxy 설정 덕분에 req.ip는 Caddy 뒤에서도 실제 접속 IP)

const httpError = (status, message) => Object.assign(new Error(message), { status })

export function rateLimit({ max, windowMs, now = Date.now, message = '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.' }) {
  const hits = new Map() // ip → { count, resetAt }

  return function rateLimitMiddleware(req, res, next) {
    const t = now()
    // 오래된 기록 정리 (메모리가 계속 늘지 않게)
    if (hits.size > 10_000) for (const [ip, h] of hits) if (h.resetAt <= t) hits.delete(ip)

    let h = hits.get(req.ip)
    if (!h || h.resetAt <= t) {
      h = { count: 0, resetAt: t + windowMs }
      hits.set(req.ip, h)
    }
    h.count++

    if (h.count > max) {
      res.set('Retry-After', String(Math.ceil((h.resetAt - t) / 1000)))
      return next(httpError(429, message))
    }
    next()
  }
}
