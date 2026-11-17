import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { getFoundItemDetail } from '../../api/foundItems.js'
import { colorDisplayName } from '../../shared/codes.js'
import KakaoMap from '../../shared/KakaoMap.jsx'
import { directionsUrl, isMobile } from '../../shared/kakaoLinks.js'
import { TAG_LABELS, TAG_ORDER, TAG_SYMBOL, tagStatus } from '../../shared/matchCopy.js'
import ScoreRing from '../../shared/ScoreRing.jsx'
import Thumbnail from '../../shared/Thumbnail.jsx'
import { conditionChips } from './conditionChips.js'
import './MatchResultsView.css'

const DISCLAIMER = '매칭 점수는 조건의 유사도이며, 실제 본인 물건인지는 보관장소에서 확인해야 합니다'
const itemKey = (it) => `${it.atcId}-${it.fdSn}`

/**
 * 매칭 결과 화면 본문 (시안 1a / 결과 없음 1b)
 * 신규 습득물 확인(6a, @kwonminsooo)에서도 쓸 수 있게 데이터는 props로 받는다.
 *
 * @param {{ lostItemId: string,
 *           condition: import('../../shared/types.js').SearchCondition,
 *           items: import('../../shared/types.js').MatchResult[],
 *           newCandidates?: import('../../shared/types.js').MatchResult[] }} props
 *   newCandidates가 있으면 헤더 아래 "지난 확인 이후 새로 들어온 습득물 {n}건" 구역을 먼저 보여준다.
 */
export default function MatchResultsView({ lostItemId, condition, items, newCandidates = [] }) {
  const all = [...newCandidates, ...items]
  const [selectedKey, setSelectedKey] = useState(null)
  const selected = all.find((it) => itemKey(it) === selectedKey) ?? all[0] ?? null // 기본 선택: 1위

  // 선택한 습득물의 보관기관 좌표 (상세 API, 서버 캐시). 결과 목록에는 좌표가 없다
  const [places, setPlaces] = useState({})
  const selKey = selected ? itemKey(selected) : null
  useEffect(() => {
    if (!selected || places[selKey] !== undefined) return
    const controller = new AbortController()
    getFoundItemDetail(selected.atcId, selected.fdSn, { signal: controller.signal })
      .then((d) => setPlaces((p) => ({ ...p, [selKey]: { name: d.orgNm || d.depPlace, location: d.location } })))
      .catch((e) => {
        if (e.name !== 'AbortError') setPlaces((p) => ({ ...p, [selKey]: { name: selected.depPlace, location: null } }))
      })
    return () => controller.abort()
  }, [selected, selKey, places])

  const place = selKey ? places[selKey] : null
  const confirmTo = `/confirm/${encodeURIComponent(lostItemId)}`

  return (
    <div className="results">
      <header className="results__header">
        <div className="results__title-row">
          <h1 className="results__title">비슷한 습득물 {items.length}건</h1>
          {items.length > 0 && <p className="results__subtitle">매칭 점수가 높은 순서예요</p>}
        </div>
        <div className="results__chips">
          {conditionChips(condition).map((c) => (
            <span key={c} className="chip">{c}</span>
          ))}
          <Link to={confirmTo} className="results__edit">조건 수정</Link>
        </div>
      </header>

      <div className="results__body">
        <div className="results__list">
          {newCandidates.length > 0 && (
            <section className="results__new" aria-label="새로 들어온 습득물">
              <h2 className="results__section-title">지난 확인 이후 새로 들어온 습득물 {newCandidates.length}건</h2>
              {newCandidates.map((it) => (
                <ResultCard key={itemKey(it)} item={it} selected={it === selected} onSelect={() => setSelectedKey(itemKey(it))} />
              ))}
            </section>
          )}

          {items.length === 0 ? (
            <EmptyState confirmTo={confirmTo} />
          ) : (
            items.map((it) => (
              <ResultCard key={itemKey(it)} item={it} selected={it === selected} onSelect={() => setSelectedKey(itemKey(it))} />
            ))
          )}
          {items.length > 0 && <p className="disclaimer results__disclaimer">{DISCLAIMER}</p>}
        </div>

        <aside className="results__side">
          <KakaoMap
            height={440}
            label={place?.name ?? selected?.depPlace ?? '보관장소'}
            pins={selected ? [{ id: selKey, ...(place?.location ?? {}), selected: true, title: place?.name ?? selected.depPlace }] : []}
          />
          {selected && <InfoPanel item={selected} lostItemId={lostItemId} place={place} />}
        </aside>
      </div>
    </div>
  )
}

function ResultCard({ item, selected, onSelect }) {
  const tags = TAG_ORDER.map((key) => item.tags.find((t) => t.key === key) ?? { key, score: null })
  return (
    <button type="button" className={`result-card${selected ? ' is-selected' : ''}`} onClick={onSelect} aria-pressed={selected}>
      <Thumbnail item={item} size={96} />
      <span className="result-card__info">
        <span className="result-card__name-row">
          <span className="result-card__name">{item.fdPrdtNm}</span>
          {item.isNew && <span className="badge-new">NEW</span>}
        </span>
        <span className="result-card__meta">
          {item.prdtClNm} · {colorDisplayName(item.clrNm)}
        </span>
        <span className="result-card__meta result-card__meta--muted">
          {item.fdYmd} 습득 · {item.depPlace} 보관
        </span>
        <span className="result-card__tags">
          {tags.map((t) => {
            const status = tagStatus(t.score)
            if (status === 'unknown') return null // 규칙표: 정보 없음은 칩 숨김
            return (
              <span key={t.key} className={`match-tag match-tag--${status}`}>
                {TAG_LABELS[t.key]} {TAG_SYMBOL[status]}
              </span>
            )
          })}
        </span>
      </span>
      <ScoreRing score={item.score} />
    </button>
  )
}

function InfoPanel({ item, lostItemId, place }) {
  const detailTo = `/items/${encodeURIComponent(item.atcId)}/${encodeURIComponent(item.fdSn)}?lostItemId=${encodeURIComponent(lostItemId)}`
  const name = place?.name ?? item.depPlace
  return (
    <section className="card results-info">
      <div className="results-info__head">
        <p className="results-info__place">{item.depPlace}</p>
        <p className="results-info__score">{item.score}% 일치</p>
      </div>
      <dl className="results-info__rows">
        <div><dt>물품</dt><dd>{item.fdPrdtNm}</dd></div>
        <div><dt>분류</dt><dd>{item.prdtClNm}</dd></div>
        <div><dt>색상</dt><dd>{colorDisplayName(item.clrNm)}</dd></div>
        <div><dt>습득일</dt><dd>{item.fdYmd}</dd></div>
      </dl>
      <div className="results-info__actions">
        <Link to={detailTo} className="btn btn-primary">상세 보기</Link>
        <a
          className="btn btn-secondary"
          href={directionsUrl({ name, location: place?.location ?? null, mobile: isMobile() })}
          target="_blank"
          rel="noopener noreferrer"
        >
          카카오맵 길찾기 ↗
        </a>
      </div>
    </section>
  )
}

function EmptyState({ confirmTo }) {
  return (
    <section className="card results-empty">
      <span className="results-empty__icon" aria-hidden="true">🔍</span>
      <h2 className="results-empty__title">아직 비슷한 습득물이 없어요</h2>
      <p className="results-empty__copy">
        습득물은 접수까지 며칠 걸릴 수 있어요. 조건을 넓히거나 나중에 다시 확인해 주세요.
      </p>
      <div className="results-empty__actions">
        <Link to={confirmTo} className="btn btn-primary">조건 수정하기</Link>
        <Link to="/" className="btn btn-secondary">새로 검색</Link>
      </div>
    </section>
  )
}
