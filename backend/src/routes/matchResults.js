import { Router } from 'express'

// /api/lost-items 아래 매칭 결과 라우트 (분실물 등록·수정 라우트는 @lym0309 담당, 같은 경로에 따로 붙는다)
export function createMatchResultsRouter({ matchResults }) {
  const router = Router()

  // GET /api/lost-items/:id/results — 경찰청 검색 + 점수 → { condition, items: MatchResult[] }
  router.get('/:id/results', async (req, res) => {
    const { id } = req.params
    if (!/^[\w-]{1,64}$/.test(id)) {
      throw Object.assign(new Error('분실물 ID 형식이 올바르지 않습니다.'), { status: 400 })
    }
    const result = await matchResults.results(id)
    if (!result) throw Object.assign(new Error('분실물을 찾을 수 없습니다.'), { status: 404 })
    res.json(result)
  })

  return router
}
