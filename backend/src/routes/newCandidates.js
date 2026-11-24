import { Router } from 'express'
import { checkIds } from './matchResults.js'

// /api/lost-items 아래 신규 후보 라우트 (시안 6a/6b)
export function createNewCandidatesRouter({ newCandidates }) {
  const router = Router()

  // GET /api/lost-items/:id/new-candidates — 마지막 확인 이후 새로 들어온 후보 (조회만, 상태를 바꾸지 않음)
  // → { lostItemId, condition, lookupCode, lastViewedAt, newItems, previousItems, hiddenItems }
  // 물품·날짜가 없으면 400, 없는 분실물 404
  router.get('/:id/new-candidates', async (req, res) => {
    checkIds(req.params)
    res.json(await newCandidates.get(req.params.id))
  })

  // PUT /api/lost-items/:id/seen-items/:atcId/:fdSn — 신규 후보를 "본 후보"로 (여러 번 해도 같음) → 204
  router.put('/:id/seen-items/:atcId/:fdSn', async (req, res) => {
    checkIds(req.params)
    await newCandidates.markSeen(req.params.id, req.params.atcId, req.params.fdSn)
    res.status(204).end()
  })

  // POST /api/lost-items/:id/viewed — 매칭 결과를 확인함 (마지막 확인 시각 = 지금) → 204
  router.post('/:id/viewed', async (req, res) => {
    checkIds(req.params)
    await newCandidates.markViewed(req.params.id)
    res.status(204).end()
  })

  return router
}
