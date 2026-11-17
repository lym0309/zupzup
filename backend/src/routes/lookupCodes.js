import { Router } from 'express'
import { rateLimit } from '../middlewares/rateLimit.js'

// 코드 조회는 IP당 10분에 30번까지 (무작위 대입 방지). 사람이 쓰기에는 충분한 횟수
export const LOOKUP_LIMIT = { max: 30, windowMs: 10 * 60 * 1000 }

export function createLookupCodesRouter({ lookupCodes, lookupLimit = LOOKUP_LIMIT }) {
  const router = Router()

  // POST /api/lookup-codes { lostItemId } — 조회 코드 발급 (이미 있으면 기존 코드) → { code, lostItemId }
  router.post('/', async (req, res) => {
    res.json(await lookupCodes.issue(req.body?.lostItemId))
  })

  // GET /api/lookup-codes/:code — 코드 → { code, lostItemId }. 형식 오류 400, 없는 코드 404, 너무 많이 시도하면 429
  router.get(
    '/:code',
    rateLimit({ ...lookupLimit, message: '조회 코드를 너무 많이 입력했어요. 잠시 후 다시 시도해 주세요.' }),
    async (req, res) => {
      res.json(await lookupCodes.find(req.params.code))
    },
  )

  return router
}
