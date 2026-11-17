import { Router } from 'express'
import { createFoundItemsRouter } from './foundItems.js'
import { createHealthRouter } from './health.js'
import { createHistoryRouter } from './history.js'
import { createLookupCodesRouter } from './lookupCodes.js'
import { createLostItemsRouter } from './lostItems.js'
import { createMatchResultsRouter } from './matchResults.js'

// /api 하위 라우터 모음
// 기능 라우터는 여기에 추가: router.use('/lost', createLostRouter(deps))
export function createApiRouter(deps) {
  const router = Router()
  router.use('/health', createHealthRouter(deps))
  router.use('/found-items', createFoundItemsRouter(deps))
  router.use('/lost-items', createLostItemsRouter(deps))
  router.use('/lookup-codes', createLookupCodesRouter(deps))
  router.use('/history', createHistoryRouter(deps))
  router.use('/lost-items', createMatchResultsRouter(deps))
  return router
}
