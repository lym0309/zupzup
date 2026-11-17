// 조회 코드 규칙 (FND-XXXX-XX)
// 헷갈리는 0/O, 1/I를 뺀 32자. 32는 256의 약수라 바이트 → 글자 변환이 고르게 나온다
// ⚠️ 프론트(front/src/pages/history/history.js)에도 같은 형식 검사가 있다. 바꾸면 같이 바꿀 것

export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const CODE_FORMAT_ERROR = '조회 코드는 FND-XXXX-XX 형식이에요'

const CODE_CHAR = '[A-HJ-NP-Z2-9]'
const CODE_PATTERN = new RegExp(`^FND-${CODE_CHAR}{4}-${CODE_CHAR}{2}$`)

/** 형식에 맞는 조회 코드인지 (대문자만) */
export const isLookupCode = (code) => typeof code === 'string' && CODE_PATTERN.test(code)

/** 앞뒤 공백 제거 + 대문자. 사용자가 소문자로 입력해도 찾을 수 있게 */
export const normalizeLookupCode = (code) => (typeof code === 'string' ? code.trim().toUpperCase() : '')

/**
 * 무작위 바이트 6개 → 조회 코드
 * @param {Uint8Array} bytes 길이 6 이상
 */
export function lookupCodeFromBytes(bytes) {
  const chars = Array.from(bytes.slice(0, 6), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
  return `FND-${chars.slice(0, 4)}-${chars.slice(4, 6)}`
}
