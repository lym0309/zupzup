import { Router } from 'express'
import { DEVICE_ID_HEADER, isDeviceId } from '../rules/deviceId.js'

export function createLostItemsRouter({ lostItems, history, log = console.warn }) {
  const router = Router()

  // POST /api/lost-items { rawText } — 문장 저장 + 조건 추출 → 201 SearchCondition (+ extracted)
  // X-Device-Id 헤더가 있으면 그 기기의 검색 기록에도 추가한다
  router.post('/', async (req, res) => {
    const item = await lostItems.create(req.body?.rawText)
    const deviceId = req.get(DEVICE_ID_HEADER)
    if (history && isDeviceId(deviceId)) {
      // 기록 저장이 실패해도 검색은 계속할 수 있게 (기록만 빠진다)
      await history.record(deviceId, item.lostItemId).catch((err) => log(`[history] 기록 저장 실패: ${err.message}`))
    }
    res.status(201).json(item)
  })

  // GET /api/lost-items/:id — 저장된 조건
  router.get('/:id', async (req, res) => {
    res.json(await lostItems.get(req.params.id))
  })

  // PATCH /api/lost-items/:id { itemName?, prdtClNm?, clrNm?, region?, dateFrom?, dateTo?, brand?, feature? }
  router.patch('/:id', async (req, res) => {
    res.json(await lostItems.update(req.params.id, req.body))
  })

  return router
}
