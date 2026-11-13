import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { getFoundItemDetail } from '../api/foundItems.js'
import { createLookupCode } from '../api/lookupCodes.js'
import { mockMatchFor } from '../mocks/matchResults.js'
import { hideItem } from '../shared/hiddenItems.js'
import KakaoMap from '../shared/KakaoMap.jsx'
import { directionsUrl, isMobile, telUrl } from '../shared/kakaoLinks.js'
import { TAG_LABELS, TAG_ORDER, headline, subCopy, tagNote, tagStatus } from '../shared/matchCopy.js'
import ScoreRing from '../shared/ScoreRing.jsx'
import Thumbnail from '../shared/Thumbnail.jsx'
import './ItemDetailPage.css'

const DISCLAIMER = '매칭 점수는 조건의 유사도이며, 실제 본인 물건인지는 보관장소에서 확인해야 합니다'

// 습득물 상세 (시안 4a). GET /api/found-items/:atcId/:fdSn
// - 매칭 결과에서 오면 ?lostItemId= 가 붙고, 매칭 설명 카드·조회 코드 저장·숨기기를 보여준다.
// - 전체 습득물에서 오면 매칭 설명 카드 없이 습득물 정보만 보여준다.
export default function ItemDetailPage() {
  const { atcId, fdSn } = useParams()
  const [searchParams] = useSearchParams()
  const lostItemId = searchParams.get('lostItemId') ?? ''
  const { state: navState } = useLocation()
  const key = `${atcId}|${fdSn}`

  const [result, setResult] = useState({ key: null, data: null, error: null })
  useEffect(() => {
    const controller = new AbortController()
    getFoundItemDetail(atcId, fdSn, { signal: controller.signal })
      .then((data) => setResult({ key, data, error: null }))
      .catch((error) => {
        if (error.name !== 'AbortError') setResult({ key, data: null, error })
      })
    return () => controller.abort()
  }, [atcId, fdSn, key])

  const loading = result.key !== key
  const item = loading ? null : result.data
  // TODO(@kim-ch2): 매칭 결과 API(GET /api/lost-items/:id/results)가 생기면 mock 대신 사용
  const matchInfo = item && lostItemId ? mockMatchFor(lostItemId, item) : null

  const back = lostItemId
    ? { to: `/results/${encodeURIComponent(lostItemId)}`, label: `← 매칭 결과${matchInfo ? ` ${matchInfo.total}건` : ''}` }
    : { to: navState?.from ?? '/browse', label: '← 전체 습득물' }

  return (
    <div className="detail">
      <div className="detail__topbar">
        <Link to={back.to} className="detail__back">
          {back.label}
        </Link>
        <span className="detail__id">
          관리번호 {atcId}-{fdSn}
        </span>
      </div>

      {loading ? (
        <p className="detail__message" role="status">습득물 정보를 불러오는 중…</p>
      ) : result.error ? (
        <div className="detail__message" role="alert">
          <p className="detail__message-title">
            {result.error.status === 404 ? '습득물을 찾을 수 없어요' : '습득물 정보를 불러오지 못했어요'}
          </p>
          <p>{result.error.status === 404 ? '이미 반환됐거나 관리번호가 바뀌었을 수 있어요.' : result.error.message}</p>
        </div>
      ) : (
        <div className="detail__body">
          <div className="detail__main">
            <ItemCard item={item} />
            {matchInfo && <MatchCard item={item} {...matchInfo} />}
            <p className="disclaimer">{DISCLAIMER}</p>
          </div>

          <aside className="detail__side">
            <KakaoMap
              height={300}
              label={item.orgNm}
              pins={[{ id: key, ...(item.location ?? {}), selected: true, title: item.orgNm }]}
            />
            <PlaceCard item={item} />
            <Actions item={item} lostItemId={lostItemId} />
          </aside>
        </div>
      )}
    </div>
  )
}

function ItemCard({ item }) {
  const rows = [
    ['색상', item.clrNm || '정보 없음'],
    ['습득일시', item.fdHor ? `${item.fdYmd} ${Number(item.fdHor)}시경` : item.fdYmd],
    ['습득장소', item.fdPlace || '정보 없음'],
    ['특이사항', item.memo || '없음', 'detail__memo'],
  ]
  return (
    <section className="card detail-item">
      <Thumbnail item={item} size={220} radius={14} />
      <div className="detail-item__info">
        <div className="detail-item__head">
          <div className="detail-item__title-row">
            <h1 className="detail-item__name">{item.fdPrdtNm}</h1>
            {item.isNew && <span className="badge-new">NEW</span>}
            {item.csteSteNm && <span className="detail-item__status">{item.csteSteNm}</span>}
          </div>
          <p className="detail-item__category">{item.prdtClNm}</p>
        </div>
        <dl className="detail-item__rows">
          {rows.map(([label, value, className]) => (
            <div key={label} className="detail-item__row">
              <dt>{label}</dt>
              <dd className={className}>{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

function MatchCard({ item, condition, match }) {
  const context = { condition, item }
  const tags = TAG_ORDER.map((key) => match.tags.find((t) => t.key === key) ?? { key, score: null })
  const sub = subCopy(tags, context)
  return (
    <section className="card detail-match" aria-label="매칭 설명">
      <div className="detail-match__summary">
        <ScoreRing score={match.score} size={96} label="매칭" />
        <div className="detail-match__copy">
          <h2 className="detail-match__headline">{headline(match.score)}</h2>
          {sub && <p className="detail-match__sub">{sub}</p>}
        </div>
      </div>
      <ul className="detail-match__tags">
        {tags.map((tag) => {
          const status = tagStatus(tag.score)
          return (
            <li key={tag.key} className="detail-match__tag">
              <div className="detail-match__tag-head">
                <span>{TAG_LABELS[tag.key]}</span>
                {status !== 'unknown' && <b>{tag.score}%</b>}
              </div>
              {status !== 'unknown' && (
                <div className="detail-match__bar">
                  <span className={`is-${status}`} style={{ width: `${tag.score}%` }} />
                </div>
              )}
              <p className="detail-match__note">{tagNote(tag, context)}</p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function PlaceCard({ item }) {
  return (
    <section className="card detail-place">
      <p className="detail-place__label">보관장소</p>
      <p className="detail-place__name">{item.orgNm || item.depPlace}</p>
      <dl className="detail-place__rows">
        {item.fndKeepOrgnSeNm && (
          <div>
            <dt>보관 구분</dt>
            <dd>{item.fndKeepOrgnSeNm}</dd>
          </div>
        )}
        <div>
          <dt>전화</dt>
          <dd>{item.tel || '정보 없음'}</dd>
        </div>
        {item.location?.address && (
          <div>
            <dt>주소</dt>
            <dd>{item.location.address}</dd>
          </div>
        )}
      </dl>
    </section>
  )
}

function Actions({ item, lostItemId }) {
  const navigate = useNavigate()
  const [codeState, setCodeState] = useState({ status: 'idle' })
  const placeName = item.orgNm || item.depPlace
  const tel = telUrl(item.tel)

  const saveCode = async () => {
    setCodeState({ status: 'saving' })
    try {
      const { code } = await createLookupCode(lostItemId)
      let copied = true
      try {
        await navigator.clipboard.writeText(code)
      } catch {
        copied = false // 클립보드 권한이 없어도 코드는 보여준다
      }
      setCodeState({ status: 'done', code, copied })
    } catch (error) {
      setCodeState({ status: 'error', message: error.message })
    }
  }

  const notMine = () => {
    hideItem(lostItemId, item.atcId, item.fdSn)
    navigate(`/results/${encodeURIComponent(lostItemId)}`)
  }

  const codeSub = {
    idle: '나중에 다시 열기',
    saving: '발급 중…',
    done: codeState.code ? `${codeState.code}${codeState.copied ? ' 복사됨' : ''}` : '',
    error: '발급하지 못했어요. 다시 눌러 주세요',
  }[codeState.status]

  return (
    <div className="detail-actions">
      <a
        className="detail-action detail-action--primary"
        href={directionsUrl({ name: placeName, location: item.location, mobile: isMobile() })}
        target="_blank"
        rel="noopener noreferrer"
      >
        <ActionText title="카카오맵 길찾기 ↗" sub="새 탭에서 경로 보기" />
      </a>

      {tel ? (
        <a className="detail-action" href={tel}>
          <ActionText title="전화 문의" sub={item.tel} />
        </a>
      ) : (
        <div className="detail-action is-disabled" aria-disabled="true">
          <ActionText title="전화 문의" sub="전화번호 없음" />
        </div>
      )}

      {lostItemId && (
        <>
          <button type="button" className="detail-action" onClick={saveCode} disabled={codeState.status === 'saving'}>
            <ActionText title="조회 코드 저장" sub={codeSub} />
          </button>
          <button type="button" className="detail-action" onClick={notMine}>
            <ActionText title="내 물건이 아니에요" sub="결과에서 숨기기" />
          </button>
        </>
      )}
    </div>
  )
}

function ActionText({ title, sub }) {
  return (
    <>
      <span className="detail-action__dot" aria-hidden="true" />
      <span className="detail-action__text">
        <span className="detail-action__title">{title}</span>
        <span className="detail-action__sub" aria-live="polite">{sub}</span>
      </span>
    </>
  )
}
