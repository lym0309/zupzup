import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { getLostItem, updateLostItem } from '../api/lostItems.js'
import { CATEGORIES, COLOR_FAMILIES, REGIONS, UNKNOWN } from '../shared/codes.js'
import './ConfirmPage.css'
import {
  CHIP_FIELDS,
  DATE_PRESETS,
  applyEdit,
  canSearch,
  chipValue,
  conditionOf,
  dateLabel,
  dateNotice,
  dateRangeError,
  draftOf,
  missingFields,
  presetOf,
  presetRange,
  removeField,
  toPatchBody,
  todayKst,
} from './confirm/confirmCondition.js'

// 조건 확인·수정 (시안 3a 성공 / 3b 실패). GET /api/lost-items/:id
// "이 조건으로 찾기" → PATCH /api/lost-items/:id → /results/:lostItemId
export default function ConfirmPage() {
  const { lostItemId } = useParams()
  const [result, setResult] = useState({ id: null, item: null, error: null })

  useEffect(() => {
    const controller = new AbortController()
    getLostItem(lostItemId, { signal: controller.signal })
      .then((item) => setResult({ id: lostItemId, item, error: null }))
      .catch((error) => {
        if (error.name !== 'AbortError') setResult({ id: lostItemId, item: null, error })
      })
    return () => controller.abort()
  }, [lostItemId])

  if (result.id !== lostItemId) {
    return (
      <div className="confirm">
        <p className="confirm__message" role="status">조건을 불러오는 중…</p>
      </div>
    )
  }

  if (result.error) {
    const notFound = result.error.status === 404
    return (
      <div className="confirm">
        <div className="confirm__message" role="alert">
          <p className="confirm__message-title">{notFound ? '검색 조건을 찾을 수 없어요' : '조건을 불러오지 못했어요'}</p>
          <p>{notFound ? '주소가 맞는지 확인하거나 새로 검색해 주세요.' : result.error.message}</p>
          <Link to="/" className="btn btn-secondary">
            새로 검색
          </Link>
        </div>
      </div>
    )
  }

  // 같은 분실물을 다시 불러오면 처음 상태로 (key)
  return <ConfirmForm key={lostItemId} item={result.item} />
}

function ConfirmForm({ item }) {
  const navigate = useNavigate()
  const [condition, setCondition] = useState(() => conditionOf(item))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const extracted = item.extracted

  const update = (next) => {
    setCondition(next)
    setError(null)
  }

  async function submit() {
    if (saving || !canSearch(condition)) return
    setSaving(true)
    setError(null)
    try {
      await updateLostItem(item.lostItemId, toPatchBody(condition))
      navigate(`/results/${encodeURIComponent(item.lostItemId)}`)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="confirm">
      <div className="confirm__column">
        <div className="confirm__raw">
          <p className="confirm__raw-label">입력하신 문장</p>
          <p className="confirm__raw-text">{item.rawText}</p>
        </div>

        <div className="confirm__head">
          <h1 className="confirm__title">{extracted ? '이 조건으로 찾아볼게요' : '조건을 직접 골라주세요'}</h1>
          <p className="confirm__desc">
            {extracted
              ? '틀린 부분은 눌러서 고치거나 지워주세요.'
              : '문장에서 물건과 장소를 알아내지 못했어요. 아래 네 가지만 정하면 바로 찾아볼게요.'}
          </p>
        </div>

        <section className={`confirm__card${extracted ? '' : ' confirm__card--select'}`}>
          {extracted ? (
            <ConditionChips condition={condition} onChange={update} />
          ) : (
            <ConditionSelects condition={condition} onChange={update} />
          )}
          <div className="confirm__divider" />
          <div className="confirm__footer">
            <p className="confirm__hint">{extracted ? dateNotice(condition) : "모르는 항목은 '잘 모르겠어요'로 두셔도 돼요"}</p>
            <button type="button" className="btn btn-primary confirm__submit" onClick={submit} disabled={saving || !canSearch(condition)}>
              {saving ? '저장하는 중…' : '이 조건으로 찾기'}
            </button>
          </div>
        </section>

        {error && (
          <p className="confirm__error" role="alert">
            {error}
          </p>
        )}

        <Link to="/" className="confirm__back">
          ← 문장 다시 쓰기
        </Link>
      </div>
    </div>
  )
}

/* ── 3a: 조건 칩 (눌러서 수정, ✕로 삭제, + 조건 추가) ── */

function ConditionChips({ condition, onChange }) {
  // editing: 수정 중인 칩 key / adding: "+ 조건 추가" 목록 열림
  const [editing, setEditing] = useState(null)
  const [adding, setAdding] = useState(false)
  const rootRef = useRef(null)

  // 바깥을 누르거나 Esc면 닫기 (적용하지 않은 수정은 버린다)
  useEffect(() => {
    if (!editing && !adding) return
    const close = () => {
      setEditing(null)
      setAdding(false)
    }
    const onDown = (e) => !rootRef.current?.contains(e.target) && close()
    const onKey = (e) => e.key === 'Escape' && close()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [editing, adding])

  // 값이 있는 칩 + 지금 추가하는 중인 칩
  const chips = CHIP_FIELDS.filter((f) => chipValue(f.key, condition) !== null || f.key === editing)
  const missing = missingFields(condition).filter((f) => f.key !== editing)

  return (
    <div className="confirm-chips" ref={rootRef}>
      {chips.map((field) => {
        const value = chipValue(field.key, condition)
        const isEditing = editing === field.key
        return (
          <div key={field.key} className="confirm-chip__wrap">
            <div className={`confirm-chip${isEditing ? ' is-editing' : ''}`}>
              <button
                type="button"
                className="confirm-chip__body"
                onClick={() => {
                  setAdding(false)
                  setEditing(isEditing ? null : field.key)
                }}
                aria-expanded={isEditing}
              >
                <span className="confirm-chip__key">{field.label}</span>
                <span className="confirm-chip__value">{value ?? '입력해 주세요'}</span>
              </button>
              {value !== null && (
                <button
                  type="button"
                  className="confirm-chip__remove"
                  aria-label={`${field.label} 조건 지우기`}
                  onClick={() => {
                    onChange(removeField(condition, field.key))
                    setEditing(null)
                  }}
                >
                  ✕
                </button>
              )}
            </div>
            {isEditing && (
              <ChipEditor
                field={field}
                initial={draftOf(condition, field.key)}
                onApply={(draft) => {
                  onChange(applyEdit(condition, field.key, draft))
                  setEditing(null)
                }}
              />
            )}
          </div>
        )
      })}

      {missing.length > 0 && (
        <div className="confirm-chip__wrap">
          <button
            type="button"
            className="confirm-chip__add"
            onClick={() => {
              setEditing(null)
              setAdding(!adding)
            }}
            aria-expanded={adding}
          >
            + 조건 추가
          </button>
          {adding && (
            <div className="confirm-popover confirm-popover--menu" role="menu">
              <p className="confirm-popover__label">추가할 조건</p>
              {missing.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  role="menuitem"
                  className="confirm-popover__item"
                  onClick={() => {
                    setAdding(false)
                    setEditing(f.key)
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** 칩 수정 팝오버: "{키} 수정" + 입력 + "적용" */
function ChipEditor({ field, initial, onApply }) {
  const [draft, setDraft] = useState(initial)
  const today = todayKst()
  const error = field.type === 'date' ? dateRangeError(draft, today) : null

  const apply = (e) => {
    e.preventDefault()
    if (!error) onApply(draft)
  }

  return (
    <form className="confirm-popover" onSubmit={apply}>
      <p className="confirm-popover__label">{field.label} 수정</p>
      {field.type === 'text' && (
        <input
          className="confirm-popover__input"
          value={draft}
          maxLength={field.max}
          onChange={(e) => setDraft(e.target.value)}
          aria-label={field.label}
          autoFocus
        />
      )}
      {field.type === 'select' && (
        <select className="confirm-select" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label={field.label} autoFocus>
          <option value="">선택해 주세요</option>
          {field.options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      )}
      {field.type === 'date' && (
        <div className="confirm-popover__dates">
          <label>
            <span>시작</span>
            <input
              type="date"
              className="confirm-popover__input"
              value={draft.dateFrom}
              max={today}
              onChange={(e) => setDraft({ ...draft, dateFrom: e.target.value })}
              autoFocus
            />
          </label>
          <label>
            <span>끝 (하루면 비워두기)</span>
            <input
              type="date"
              className="confirm-popover__input"
              value={draft.dateTo}
              min={draft.dateFrom || undefined}
              max={today}
              onChange={(e) => setDraft({ ...draft, dateTo: e.target.value })}
            />
          </label>
        </div>
      )}
      {error && <p className="confirm-popover__error">{error}</p>}
      <button type="submit" className="confirm-popover__apply" disabled={Boolean(error)}>
        적용
      </button>
    </form>
  )
}

/* ── 3b: 드롭다운 4개 (물품 종류 / 색상 / 지역 / 날짜) ── */

function ConditionSelects({ condition, onChange }) {
  const today = todayKst()
  const preset = presetOf(condition, today)

  const fields = [
    {
      label: '물품 종류',
      value: condition.prdtClNm ?? '',
      options: [['', '선택해 주세요'], ...CATEGORIES.map((c) => [c.name, c.name])],
      set: (v) => onChange({ ...condition, prdtClNm: v || null }),
    },
    {
      label: '색상',
      value: condition.clrNm ?? UNKNOWN,
      options: [[UNKNOWN, '잘 모르겠어요'], ...COLOR_FAMILIES.map((c) => [c, c])],
      set: (v) => onChange({ ...condition, clrNm: v || null }),
    },
    {
      label: '지역',
      value: condition.region ?? UNKNOWN,
      options: [[UNKNOWN, '잘 모르겠어요'], ...REGIONS.map((r) => [r.name, r.name])],
      set: (v) => onChange({ ...condition, region: v || null }),
    },
    {
      label: '날짜',
      value: preset,
      options: [
        ['', '선택해 주세요'],
        ...DATE_PRESETS.map((p) => [p.id, p.label]),
        // 저장된 날짜가 선택지에 없으면 그대로 보여준다
        ...(preset === 'custom' ? [['custom', dateLabel(condition)]] : []),
      ],
      set: (v) => v !== 'custom' && onChange({ ...condition, ...presetRange(v, today) }),
    },
  ]

  return (
    <div className="confirm-selects">
      {fields.map((f) => (
        <label key={f.label} className="confirm-selects__field">
          <span className="confirm-selects__label">{f.label}</span>
          <select className="confirm-select" value={f.value} onChange={(e) => f.set(e.target.value)}>
            {f.options.map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  )
}
