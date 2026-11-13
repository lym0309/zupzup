import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { getMatchResults } from '../api/matchResults.js'
import Placeholder from '../components/Placeholder.jsx'
import MatchResultsView from './results/MatchResultsView.jsx'

// TODO(@kwonminsooo): ?new=1 이면 신규 습득물 확인 (시안 6a / 6b) — GET /api/lost-items/:id/new-candidates
//   MatchResultsView에 newCandidates를 넘기면 "지난 확인 이후 새로 들어온 습득물" 구역이 먼저 보인다.
export default function ResultsPage() {
  const { lostItemId } = useParams()
  const [searchParams] = useSearchParams()
  const isNewView = searchParams.get('new') === '1'

  return isNewView ? (
    <Placeholder screen="6a / 6b" title="새로 들어온 습득물" owner="@kwonminsooo">
      <p>
        lostItemId: <code>{lostItemId}</code>
      </p>
    </Placeholder>
  ) : (
    <MatchResults lostItemId={lostItemId} />
  )
}

// 매칭 결과 (시안 1a / 결과 없음 1b) — GET /api/lost-items/:id/results
function MatchResults({ lostItemId }) {
  const [result, setResult] = useState({ key: null, data: null, error: null })
  useEffect(() => {
    const controller = new AbortController()
    getMatchResults(lostItemId, { signal: controller.signal })
      .then((data) => setResult({ key: lostItemId, data, error: null }))
      .catch((error) => {
        if (error.name !== 'AbortError') setResult({ key: lostItemId, data: null, error })
      })
    return () => controller.abort()
  }, [lostItemId])

  if (result.key !== lostItemId) {
    return (
      <Placeholder title="비슷한 습득물을 찾는 중…">
        <p>경찰청 습득물을 조건과 비교하고 있어요. 처음에는 몇 초 걸릴 수 있어요.</p>
      </Placeholder>
    )
  }
  if (result.error) {
    const notFound = result.error.status === 404
    return (
      <Placeholder title={notFound ? '검색 기록을 찾을 수 없어요' : '매칭 결과를 불러오지 못했어요'}>
        <p>{notFound ? '조회 코드나 주소를 다시 확인해 주세요.' : result.error.message}</p>
        <p>
          <Link to="/">새로 검색하기</Link>
        </p>
      </Placeholder>
    )
  }

  // "내 물건이 아니에요"로 숨긴 습득물은 서버가 이미 뺐다
  return <MatchResultsView lostItemId={lostItemId} condition={result.data.condition} items={result.data.items} />
}
