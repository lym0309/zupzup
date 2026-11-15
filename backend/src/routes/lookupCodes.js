import { Router } from 'express'

export function createLookupCodesRouter({ lookupCodes }) {
  const router = Router()

  // POST /api/lookup-codes { lostItemId } — 조회 코드 발급 (이미 있으면 기존 코드) → { code, lostItemId }
  router.post('/', async (req, res) => {
    res.json(await lookupCodes.issue(req.body?.lostItemId))
  })

  // GET /api/lookup-codes/:code — 코드 → { code, lostItemId }. 형식 오류 400, 없는 코드 404
  router.get('/:code', async (req, res) => {
    res.json(await lookupCodes.find(req.params.code))
  })

  return router
}
