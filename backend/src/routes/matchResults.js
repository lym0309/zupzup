import { Router } from 'express'

// /api/lost-items 아래 매칭 결과·숨기기 라우트 (등록·조회·수정은 routes/lostItems.js)
const LOST_ITEM_ID = /^[\w-]{1,64}$/
// 관리번호: 경찰관서 F2026111200005435, 포털기관 V0007751L11100002 / 순번: 1 (routes/foundItems.js와 같음)
const ATC_ID = /^[A-Z][0-9A-Z]{5,29}$/
const FD_SN = /^\d{1,5}$/

const badRequest = (message) => Object.assign(new Error(message), { status: 400 })

function checkIds({ id, atcId, fdSn }) {
  if (!LOST_ITEM_ID.test(id)) throw badRequest('분실물 ID 형식이 올바르지 않습니다.')
  if (atcId !== undefined && (!ATC_ID.test(atcId) || !FD_SN.test(fdSn))) {
    throw badRequest('관리번호 형식이 올바르지 않습니다.')
  }
}

export function createMatchResultsRouter({ matchResults }) {
  const router = Router()

  // GET /api/lost-items/:id/results — 매칭 결과 → { condition, items: MatchResult[] }
  // 물품·날짜가 없으면 400, 없는 분실물 404
  router.get('/:id/results', async (req, res) => {
    checkIds(req.params)
    res.json(await matchResults.results(req.params.id))
  })

  // PUT /api/lost-items/:id/hidden-items/:atcId/:fdSn — "내 물건이 아니에요" (여러 번 해도 같음) → 204
  router.put('/:id/hidden-items/:atcId/:fdSn', async (req, res) => {
    checkIds(req.params)
    await matchResults.hide(req.params.id, req.params.atcId, req.params.fdSn)
    res.status(204).end()
  })

  // DELETE /api/lost-items/:id/hidden-items/:atcId/:fdSn — 숨기기 취소 → 204
  router.delete('/:id/hidden-items/:atcId/:fdSn', async (req, res) => {
    checkIds(req.params)
    await matchResults.unhide(req.params.id, req.params.atcId, req.params.fdSn)
    res.status(204).end()
  })

  return router
}
