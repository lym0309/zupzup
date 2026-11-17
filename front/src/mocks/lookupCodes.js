// mock: POST /api/lookup-codes (권민수 API가 머지되면 삭제)
// 조회 코드 형식은 시안 기준: FND-7K2Q-48
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const pick = (n) => Array.from({ length: n }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('')

export async function mockCreateLookupCode(lostItemId) {
  return { code: `FND-${pick(4)}-${pick(2)}`, lostItemId }
}
