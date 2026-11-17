// 조회 코드 발급·조회 (POST /api/lookup-codes, GET /api/lookup-codes/:code)
import { randomBytes } from 'node:crypto'
import { CODE_FORMAT_ERROR, isLookupCode, lookupCodeFromBytes, normalizeLookupCode } from '../rules/lookupCode.js'
import { LOST_ITEM_ID } from './lostItems.js'

const httpError = (status, message) => Object.assign(new Error(message), { status })

export const newLookupCode = () => lookupCodeFromBytes(randomBytes(6))

// 32^6 ≈ 10억 가지라 겹칠 일은 거의 없지만, 겹치면 새 코드로 몇 번 더 시도한다
const MAX_ATTEMPTS = 5

export function createLookupCodesService({ repo, lostItemsRepo, newCode = newLookupCode }) {
  /** lostItemId → 조회 코드. 이미 있으면 기존 코드 (분실물 하나에 코드 하나) */
  async function issue(lostItemId) {
    const exists = LOST_ITEM_ID.test(lostItemId ?? '') && (await lostItemsRepo.findById(lostItemId))
    if (!exists) throw httpError(404, '분실물을 찾을 수 없어요.')

    const existing = await repo.findByLostItemId(lostItemId)
    if (existing) return { code: existing, lostItemId }

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const saved = await repo.insert(newCode(), lostItemId)
      if (saved) return { code: saved, lostItemId }
    }
    throw new Error('조회 코드를 만들지 못했어요 (계속 겹침)')
  }

  /** 조회 코드 → lostItemId. 소문자·앞뒤 공백은 봐준다 */
  async function find(rawCode) {
    const code = normalizeLookupCode(rawCode)
    if (!isLookupCode(code)) throw httpError(400, CODE_FORMAT_ERROR)

    const lostItemId = await repo.findByCode(code)
    if (!lostItemId) throw httpError(404, '이 조회 코드로 저장된 검색이 없어요.')
    return { code, lostItemId }
  }

  return { issue, find }
}
