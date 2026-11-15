import { Router } from 'express'
import { DEVICE_ID_HEADER } from '../rules/deviceId.js'

// 기기는 X-Device-Id 헤더로 구분한다
export function createHistoryRouter({ history }) {
  const router = Router()

  // GET /api/history — 이 기기의 검색 기록 → { items: [{ condition, lookupCode, searchedAt, resultCount, newCount }] }
  router.get('/', async (req, res) => {
    res.json(await history.list(req.get(DEVICE_ID_HEADER)))
  })

  // DELETE /api/history — 이 기기의 검색 기록 전체 삭제 → { deleted }
  router.delete('/', async (req, res) => {
    res.json(await history.clear(req.get(DEVICE_ID_HEADER)))
  })

  return router
}
