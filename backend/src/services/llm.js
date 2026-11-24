import { env } from '../config/env.js'
import { COLOR_FAMILIES } from '../rules/colors.js'
import { CATEGORIES, REGIONS } from '../rules/foundItemCodes.js'

// Gemini: 분실물 설명 문장 → 검색 조건 (POST /api/lost-items의 extractor)
// - 응답 형식(JSON 스키마)을 지정해서 정해진 필드·목록 안의 값만 받는다
// - 결과는 lostItems.js에서 사용자 입력과 같은 규칙(sanitizeCondition)으로 한 번 더 걸러진다
// - 키(GEMINI_API_KEY)가 없으면 null → 지금처럼 3b(직접 고르기) 화면으로
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const ATTEMPT_TIMEOUT_MS = 6000 // 한 모델이 응답 없이 붙잡고 있으면 다음 모델로
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

const categoryNames = CATEGORIES.map((c) => c.name)
const regionNames = REGIONS.map((r) => r.name)

const nullableString = (description, extra = {}) => ({ type: 'STRING', nullable: true, description, ...extra })

// Gemini responseSchema (OpenAPI 형식). 필드 이름은 공유 계약 SearchCondition과 같음
export const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    itemName: nullableString('잃어버린 물건 이름 (색상·브랜드 제외, 짧게)'),
    prdtClNm: nullableString('물품 분류', { enum: categoryNames }),
    clrNm: nullableString('물건 색상 계열', { enum: COLOR_FAMILIES }),
    region: nullableString('잃어버린 곳의 시·도', { enum: regionNames }),
    dateFrom: nullableString('잃어버린 날짜(시작) YYYY-MM-DD'),
    dateTo: nullableString('잃어버린 날짜(끝) YYYY-MM-DD'),
    brand: nullableString('브랜드'),
    feature: nullableString('찾을 때 도움이 되는 특징'),
  },
  required: ['itemName', 'prdtClNm', 'clrNm', 'region', 'dateFrom', 'dateTo', 'brand', 'feature'],
  propertyOrdering: ['itemName', 'prdtClNm', 'clrNm', 'region', 'dateFrom', 'dateTo', 'brand', 'feature'],
}

/** "2026-11-24" → "2026-11-24(화)" */
export function withWeekday(ymd) {
  return `${ymd}(${WEEKDAYS[new Date(`${ymd}T00:00:00Z`).getUTCDay()]})`
}

/** 시스템 지시문. today(KST)를 넣어 "어제", "지난주 금요일" 같은 표현을 날짜로 바꾸게 한다 */
export function buildInstruction(today) {
  return `너는 분실물 검색 서비스의 조건 추출기다. 사용자가 잃어버린 물건을 설명한 문장에서 검색 조건을 뽑아 JSON으로만 답한다.
오늘은 ${withWeekday(today)}이고, 날짜는 모두 한국 시간 기준이다.

규칙
- 문장에서 알 수 없는 값은 null. 추측해서 채우지 않는다.
- itemName: 잃어버린 물건 이름을 짧게 (예: "에어팟 프로 케이스", "반지갑", "학생증"). 색상·브랜드는 넣지 않는다.
- prdtClNm: 아래 분류 중 하나. 예: 이어폰·에어팟·태블릿·카메라·충전기 → 전자기기, 노트북 → 컴퓨터, 스마트폰 → 휴대폰, 신분증·학생증·여권 → 증명서, 교통카드·신용카드 → 카드, 옷·모자·목도리 → 의류, 반지·목걸이·시계 → 귀금속, 우산·안경·인형처럼 맞는 분류가 없으면 기타물품.
  분류 목록: ${categoryNames.join(', ')}
- clrNm: 물건(본체)의 색상 계열 중 하나. 예: 블랙 → 검정, 화이트·아이보리 → 흰색, 네이비 → 남색, 실버 → 은색, 베이지 → 갈색, 핑크 → 분홍.
  색상 목록: ${COLOR_FAMILIES.join(', ')}
- region: 잃어버린 곳의 시·도 중 하나. 역·지하철 노선·동네 이름으로 확실히 알 수 있을 때만 (예: 2호선·강남역·홍대 → 서울, 해운대 → 부산). 여러 지역에 걸쳐 있거나 모르면 null.
  지역 목록: ${regionNames.join(', ')}
- dateFrom, dateTo: 잃어버린 날짜 (YYYY-MM-DD). 하루면 둘 다 같은 날짜.
  "오늘" → 오늘, "어제" → 어제, "그저께" → 오늘-2일, "지난주 금요일" → 그 날짜.
  "며칠 전"·"최근"처럼 정확하지 않으면 dateFrom = 오늘-6일, dateTo = 오늘. "이번 주"는 이번 주 월요일 ~ 오늘, "지난주"는 지난주 월요일 ~ 일요일.
  오늘 이후 날짜는 쓰지 않는다. 날짜 표현이 없으면 둘 다 null.
- brand: 브랜드나 제조사 (예: Apple, 삼성, 나이키). 없으면 null.
- feature: 물건을 알아볼 수 있는 특징을 짧게 (예: "투명 케이스, 곰돌이 스티커", "안에 학생증"). 위 필드에 이미 넣은 내용은 반복하지 않는다. 없으면 null.`
}

export function createGeminiExtractor({
  apiKey = env.gemini.apiKey,
  models = env.gemini.models,
  fetchFn = fetch,
  timeoutMs = env.gemini.timeoutMs,
  attemptTimeoutMs = ATTEMPT_TIMEOUT_MS,
  now = Date.now,
  log = console.warn,
} = {}) {
  async function call(model, rawText, today, ms) {
    const res = await fetchFn(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: buildInstruction(today) }] },
        contents: [{ role: 'user', parts: [{ text: rawText }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
      }),
      signal: AbortSignal.timeout(ms),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return normalizeDates(parseResponse(await res.json()))
  }

  /**
   * 모델을 순서대로 시도하고, 시간이 남으면 목록을 한 번 더 돈다 (무료 키는 503 "high demand"·429가 잦아서)
   * 전체 시간은 timeoutMs 안에서
   * @returns {Promise<object | null>} 추출한 조건 (모르는 값은 null). 키가 없으면 null
   */
  async function extract(rawText, { today }) {
    if (!apiKey || models.length === 0) return null
    const deadline = now() + timeoutMs
    let lastError = null
    for (const model of [...models, ...models]) {
      const left = deadline - now()
      if (left <= 0) break
      try {
        return await call(model, rawText, today, Math.min(left, attemptTimeoutMs))
      } catch (err) {
        lastError = err
        log(`[llm] ${model} 실패: ${err.message}`)
      }
    }
    throw new Error(`Gemini 추출 실패 (${lastError?.message ?? '시간 초과'})`)
  }

  return Object.assign(extract, { enabled: Boolean(apiKey) })
}

/** 날짜가 하나만 있으면 그 하루로 본다 (검색하려면 시작·끝이 둘 다 있어야 함) */
export function normalizeDates(condition) {
  const dateFrom = condition.dateFrom || condition.dateTo || null
  const dateTo = condition.dateTo || condition.dateFrom || null
  return { ...condition, dateFrom, dateTo }
}

/** generateContent 응답 → 조건 객체. 답이 없거나(차단 등) JSON이 아니면 오류 */
export function parseResponse(body) {
  const candidate = body?.candidates?.[0]
  const text = (candidate?.content?.parts ?? [])
    .filter((p) => typeof p.text === 'string' && !p.thought)
    .map((p) => p.text)
    .join('')
  if (!text) throw new Error(`Gemini 응답 없음 (${candidate?.finishReason ?? body?.promptFeedback?.blockReason ?? 'unknown'})`)

  const value = JSON.parse(text)
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Gemini 응답이 객체가 아님')
  return value
}
