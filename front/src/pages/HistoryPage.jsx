import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { clearHistory, getHistory, lookupCode } from '../api/history.js'
import './HistoryPage.css'
import {
  CODE_FORMAT_ERROR,
  CODE_NOT_FOUND_ERROR,
  CODE_PLACEHOLDER,
  conditionChips,
  formatCodeInput,
  formatSearchedAt,
  isValidCode,
} from './history/history.js'

// 검색 기록 · 조회 코드로 열기 (시안 5a). ?code= 로 들어오면 조회 코드 입력칸에 포커스
export default function HistoryPage() {
  const [searchParams] = useSearchParams()
  const focusCode = searchParams.has('code')

  return (
    <div className="history">
      <h1 className="history__title">검색 기록</h1>
      {/* key: 사이드바에서 "조회 코드로 열기"를 다시 눌러도 포커스되도록 */}
      <LookupCodeCard key={String(focusCode)} autoFocus={focusCode} initialCode={searchParams.get('code') ?? ''} />
      <HistoryList />
      <p className="disclaimer history__note">
        검색 기록은 이 기기에만 저장돼요. 다른 기기에서 보려면 조회 코드를 저장해 두세요.
      </p>
    </div>
  )
}

function LookupCodeCard({ autoFocus, initialCode }) {
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [code, setCode] = useState(() => formatCodeInput(initialCode))
  const [error, setError] = useState(null)
  const [opening, setOpening] = useState(false)

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  async function open(e) {
    e.preventDefault()
    if (opening) return
    if (!isValidCode(code)) {
      setError(CODE_FORMAT_ERROR)
      return
    }
    setOpening(true)
    setError(null)
    try {
      const found = await lookupCode(code)
      if (!found) {
        setError(CODE_NOT_FOUND_ERROR)
        setOpening(false)
        return
      }
      navigate(`/results/${found.lostItemId}`)
    } catch (err) {
      setError(err.message)
      setOpening(false)
    }
  }

  return (
    <form className="history__code-card" onSubmit={open}>
      <div className="history__code-head">
        <h2 className="history__code-title">조회 코드로 열기</h2>
        <p className="history__code-desc">다른 기기에서 저장한 검색을 코드로 이어볼 수 있어요</p>
      </div>
      <div className="history__code-row">
        <input
          ref={inputRef}
          className={`history__code-input${error ? ' is-error' : ''}`}
          value={code}
          onChange={(e) => {
            setCode(formatCodeInput(e.target.value))
            setError(null)
          }}
          placeholder={CODE_PLACEHOLDER}
          aria-label="조회 코드"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'history-code-error' : undefined}
          autoComplete="off"
          spellCheck={false}
          disabled={opening}
        />
        <button type="submit" className="btn btn-primary" disabled={opening || code.length === 0}>
          {opening ? '여는 중…' : '열기'}
        </button>
      </div>
      {error && (
        <p id="history-code-error" className="history__code-error" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}

function HistoryList() {
  const [items, setItems] = useState(null) // null = 불러오는 중
  const [error, setError] = useState(null)
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    let cancelled = false
    getHistory()
      .then((data) => !cancelled && setItems(data.items))
      .catch((err) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
  }, [])

  async function clearAll() {
    if (!window.confirm('이 기기의 검색 기록을 모두 지울까요? 조회 코드가 있으면 다시 열 수 있어요.')) return
    setClearing(true)
    try {
      await clearHistory()
      setItems([])
    } catch (err) {
      setError(err.message)
    } finally {
      setClearing(false)
    }
  }

  if (error) {
    return (
      <p className="history__error" role="alert">
        {error}
      </p>
    )
  }
  if (items === null) return <p className="history__loading">검색 기록을 불러오는 중…</p>

  return (
    <section className="history__section" aria-labelledby="history-count">
      <div className="history__section-head">
        <h2 id="history-count" className="history__count">
          이 기기에서 한 검색 {items.length}건
        </h2>
        {items.length > 0 && (
          <button type="button" className="history__clear" onClick={clearAll} disabled={clearing}>
            전체 삭제
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="history__empty">
          <p>아직 이 기기에서 한 검색이 없어요</p>
          <Link to="/" className="btn btn-secondary">
            새 검색 시작하기
          </Link>
        </div>
      ) : (
        <ul className="history__list">
          {items.map((entry) => (
            <HistoryCard key={entry.condition.lostItemId} entry={entry} />
          ))}
        </ul>
      )}
    </section>
  )
}

/** @param {{ entry: import('../mocks/history.js').HistoryEntry }} props */
function HistoryCard({ entry }) {
  const { condition, lookupCode: code, searchedAt, resultCount, newCount } = entry
  const resultsPath = `/results/${condition.lostItemId}`

  return (
    <li className="history-card">
      <div className="history-card__body">
        {/* 카드 전체가 이 링크 (::after로 영역 확장) */}
        <Link to={resultsPath} className="history-card__link">
          {condition.rawText}
        </Link>
        <div className="history-card__chips">
          {conditionChips(condition).map((chip) => (
            <span key={chip} className="history-card__chip">
              {chip}
            </span>
          ))}
        </div>
        <p className="history-card__meta">
          {formatSearchedAt(searchedAt)} · 조회 코드 {code}
        </p>
      </div>

      <div className="history-card__side">
        <p className="history-card__total">{resultCount}건</p>
        {newCount > 0 ? (
          <Link to={`${resultsPath}?new=1`} className="history-card__new">
            새 습득물 {newCount}건
          </Link>
        ) : (
          <span className="history-card__no-new">새 습득물 없음</span>
        )}
      </div>
    </li>
  )
}
