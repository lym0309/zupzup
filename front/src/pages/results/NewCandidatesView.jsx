import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { getNewCandidates, markSeen } from '../../api/newCandidates.js'
import KakaoMap from '../../shared/KakaoMap.jsx'
import { TAG_LABELS, TAG_ORDER, TAG_SYMBOL, headline, tagStatus } from '../../shared/matchCopy.js'
import ScoreRing from '../../shared/ScoreRing.jsx'
import Thumbnail from '../../shared/Thumbnail.jsx'
import { todayKst } from '../confirm/confirmCondition.js'
import { conditionChips } from '../history/history.js'
import { headerSub, itemId, mapPins, receivedLabel, splitHidden } from './newCandidates.js'
import './NewCandidatesView.css'

const DISCLAIMER = '매칭 점수는 조건의 유사도이며, 실제 본인 물건인지는 보관장소에서 확인해야 합니다'

// 신규 습득물 확인 (시안 6a / 새 습득물 없음 6b). /results/:lostItemId?new=1
// 검색 기록의 "새 습득물 n건"에서 들어온다. 지난 확인 이후 새로 들어온 후보를 먼저 보여준다.
// TODO(@kim-ch2·@kwonminsooo): 결과 카드·정보 패널은 매칭 결과(1a, #25)와 같은 모양 → #25 머지 후 공용 컴포넌트로 합치기
export default function NewCandidatesView({ lostItemId }) {
  const [result, setResult] = useState({ id: null, data: null, error: null })

  useEffect(() => {
    const controller = new AbortController()
    getNewCandidates(lostItemId, { signal: controller.signal })
      .then((data) => setResult({ id: lostItemId, data, error: null }))
      .catch((error) => {
        if (error.name !== 'AbortError') setResult({ id: lostItemId, data: null, error })
      })
    return () => controller.abort()
  }, [lostItemId])

  if (result.id !== lostItemId) {
    return (
      <div className="newc">
        <p className="newc__message" role="status">새로 들어온 습득물을 확인하는 중…</p>
      </div>
    )
  }
  if (result.error) {
    return (
      <div className="newc">
        <BackLink />
        <p className="newc__message newc__message--error" role="alert">
          {result.error.status === 404 ? '검색을 찾을 수 없어요. 검색 기록에서 다시 열어 주세요.' : result.error.message}
        </p>
      </div>
    )
  }
  return <Loaded key={lostItemId} lostItemId={lostItemId} data={result.data} />
}

function BackLink() {
  return (
    <Link to="/history" className="newc__back">
      ← 검색 기록
    </Link>
  )
}

function Loaded({ lostItemId, data }) {
  const today = todayKst()
  // "내 물건이 아니에요"로 숨긴 습득물은 서버가 응답의 hiddenItems로 따로 준다
  const { newItems, previousItems, hiddenItems } = useMemo(() => splitHidden(data), [data])
  const isEmpty = newItems.length === 0

  const [showHidden, setShowHidden] = useState(false)
  // 6a는 신규 후보에 집중하도록 이전 결과를 접어 두고, 6b는 펼쳐 둔다
  const [previousOpen, setPreviousOpen] = useState(isEmpty)
  const [selectedId, setSelectedId] = useState(() => {
    const first = newItems[0] ?? previousItems[0]
    return first ? itemId(first) : null
  })

  const previousRows = showHidden ? [...previousItems, ...hiddenItems] : previousItems
  const all = [...newItems, ...previousRows]
  const selected = all.find((item) => itemId(item) === selectedId) ?? null
  const pins = mapPins({ newItems, previousItems: previousOpen ? previousRows : [] }, selectedId)
  const select = useCallback((id) => setSelectedId(id), [])

  return (
    <div className="newc">
      <header className="newc__header">
        <BackLink />
        <h1 className="newc__title">새로 들어온 습득물 {newItems.length}건</h1>
        <p className="newc__sub">{headerSub(data)}</p>
        <div className="newc__conditions">
          {conditionChips(data.condition).map((chip) => (
            <span key={chip} className="chip">
              {chip}
            </span>
          ))}
          <Link to={`/confirm/${encodeURIComponent(lostItemId)}`} className="newc__edit">
            조건 수정
          </Link>
        </div>
      </header>

      <div className="newc__body">
        <div className="newc__left">
          {isEmpty ? (
            <EmptyCard />
          ) : (
            <ul className="newc__cards" aria-label="새로 들어온 습득물">
              {newItems.map((item) => (
                <li key={itemId(item)}>
                  <CandidateCard
                    item={item}
                    received={receivedLabel(item.regYmd, today)}
                    selected={itemId(item) === selectedId}
                    onSelect={select}
                  />
                </li>
              ))}
            </ul>
          )}

          <section className="newc__previous" aria-labelledby="newc-previous-title">
            <div className="newc__previous-head">
              <h2 id="newc-previous-title" className="newc__previous-title">
                이전에 확인한 습득물 {previousItems.length}건
              </h2>
              <button
                type="button"
                className="newc__toggle"
                aria-expanded={previousOpen}
                aria-controls="newc-previous-list"
                onClick={() => setPreviousOpen((open) => !open)}
              >
                {previousOpen ? '접기' : '펼치기'}
              </button>
            </div>

            {previousOpen && (
              <div id="newc-previous-list">
                {previousRows.length > 0 && (
                  <ul className="card newc__rows">
                    {previousRows.map((item) => (
                      <li key={itemId(item)}>
                        <PreviousRow
                          item={item}
                          isHiddenItem={hiddenItems.includes(item)}
                          selected={itemId(item) === selectedId}
                          onSelect={select}
                        />
                      </li>
                    ))}
                  </ul>
                )}
                {hiddenItems.length > 0 && (
                  <p className="newc__hidden">
                    숨긴 습득물 {hiddenItems.length}건 ·{' '}
                    <button type="button" className="newc__hidden-toggle" onClick={() => setShowHidden((v) => !v)}>
                      {showHidden ? '다시 숨기기' : '다시 보기'}
                    </button>
                  </p>
                )}
              </div>
            )}
          </section>

          <p className="disclaimer">{DISCLAIMER}</p>
        </div>

        <aside className="newc__right" aria-label="보관장소 지도">
          <div className="newc__map">
            <KakaoMap height={340} label={selected?.depPlace ?? ''} pins={pins} onSelect={select} />
            <div className="newc__legend" aria-hidden="true">
              <span>
                <i className="newc__legend-dot newc__legend-dot--new" />새 습득물
              </span>
              <span>
                <i className="newc__legend-dot newc__legend-dot--previous" />
                이전 결과
              </span>
            </div>
          </div>
          {selected && <InfoPanel item={selected} lostItemId={lostItemId} />}
        </aside>
      </div>
    </div>
  )
}

function EmptyCard() {
  return (
    <section className="card newc__empty">
      <span className="newc__empty-icon" aria-hidden="true">
        ✓
      </span>
      <h2 className="newc__empty-title">지난 확인 이후 새로 들어온 습득물이 없어요</h2>
      <p className="newc__empty-desc">
        이전에 확인한 결과는 아래에 그대로 있어요. 조건을 넓히면 더 많은 습득물을 찾을 수 있어요.
      </p>
    </section>
  )
}

function MatchTags({ tags }) {
  const ordered = TAG_ORDER.map((key) => tags.find((t) => t.key === key)).filter(Boolean)
  return (
    <div className="newc__tags">
      {ordered.map((tag) => {
        const status = tagStatus(tag.score)
        if (status === 'unknown') return null // 규칙표: 정보 없음은 칩 숨김
        return (
          <span key={tag.key} className={`match-tag match-tag--${status}`}>
            {TAG_LABELS[tag.key]} {TAG_SYMBOL[status]}
          </span>
        )
      })}
    </div>
  )
}

function CandidateCard({ item, received, selected, onSelect }) {
  return (
    <button
      type="button"
      className={`card newc-card${selected ? ' is-selected' : ''}`}
      aria-pressed={selected}
      onClick={() => onSelect(itemId(item))}
    >
      <Thumbnail item={item} size={96} />
      <div className="newc-card__body">
        <p className="newc-card__badges">
          <span className="badge-new">NEW</span>
          {received && <span className="newc-card__received">{received}</span>}
        </p>
        <p className="newc-card__name">{item.fdPrdtNm}</p>
        <p className="newc-card__meta">
          {item.fdYmd} 습득 · {item.depPlace} 보관
        </p>
        <MatchTags tags={item.tags} />
      </div>
      <ScoreRing score={item.score} />
    </button>
  )
}

function PreviousRow({ item, isHiddenItem, selected, onSelect }) {
  return (
    <button
      type="button"
      className={`newc-row${selected ? ' is-selected' : ''}${isHiddenItem ? ' is-hidden' : ''}`}
      aria-pressed={selected}
      onClick={() => onSelect(itemId(item))}
    >
      <span className="newc-row__text">
        <span className="newc-row__name">
          {item.fdPrdtNm}
          {isHiddenItem && <span className="newc-row__hidden-label">숨김</span>}
        </span>
        <span className="newc-row__meta">
          {item.fdYmd} 습득 · {item.depPlace} 보관
        </span>
      </span>
      <span className="newc-row__score">{item.score}%</span>
    </button>
  )
}

function InfoPanel({ item, lostItemId }) {
  // 신규 후보 상세로 들어가면 "본 후보"로 기록 → 다음 재조회 때 신규에서 빠진다
  // 기록이 실패해도 상세는 열리게 (다음에 다시 신규로 보일 뿐)
  const recordSeen = () => {
    if (item.isNew) markSeen(lostItemId, item.atcId, item.fdSn).catch(() => {})
  }
  const detailPath = `/items/${encodeURIComponent(item.atcId)}/${encodeURIComponent(item.fdSn)}?lostItemId=${encodeURIComponent(lostItemId)}`
  return (
    <section className="card newc-info" aria-label="선택한 습득물">
      <div className="newc-info__head">
        <Thumbnail item={item} size={72} />
        <div className="newc-info__title">
          {item.isNew && <span className="badge-new">NEW</span>}
          <p className="newc-info__name">{item.fdPrdtNm}</p>
          <p className="newc-info__meta">
            {item.fdYmd} 습득 · {item.depPlace} 보관
          </p>
        </div>
        <ScoreRing score={item.score} />
      </div>
      {headline(item.score) && <p className="newc-info__headline">{headline(item.score)}</p>}
      <MatchTags tags={item.tags} />
      <Link to={detailPath} className="btn btn-primary newc-info__detail" onClick={recordSeen}>
        상세 보기
      </Link>
    </section>
  )
}
