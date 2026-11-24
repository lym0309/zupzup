// 기기별 검색 기록 (GET/DELETE /api/history). 분실물을 등록하면 그 기기의 기록에 추가된다
import { isDeviceId } from '../rules/deviceId.js'
import { toResponse } from './lostItems.js'

const httpError = (status, message) => Object.assign(new Error(message), { status })

function requireDeviceId(deviceId) {
  if (!isDeviceId(deviceId)) throw httpError(400, '기기 정보가 없어요. 페이지를 새로고침해 주세요.')
}

/**
 * @param {{ repo: object, lookupCodes: object,
 *           counts?: ((lostItemId: string) => Promise<{ resultCount: number, newCount: number } | null>) | null,
 *           log?: Function }} deps  counts: 신규 후보 서비스의 counts (결과 수·새 후보 수)
 */
export function createHistoryService({ repo, lookupCodes, counts = null, log = console.warn }) {
  /** 이 기기의 기록에 분실물 추가 + 조회 코드 발급 (기록 카드에 코드가 보이도록) */
  async function record(deviceId, lostItemId) {
    requireDeviceId(deviceId)
    await repo.upsert(deviceId, lostItemId)
    await lookupCodes.issue(lostItemId)
  }

  // 결과 수를 못 구하면(조건 부족·계산 실패) 카드에서 숨긴다: resultCount null, newCount 0
  async function countsOf(lostItemId) {
    if (!counts) return null
    try {
      return await counts(lostItemId)
    } catch (err) {
      log(`[history] 결과 수 계산 실패 (${lostItemId}): ${err.message}`)
      return null
    }
  }

  /**
   * 이 기기의 기록, 최근 검색 순
   * - resultCount: 매칭 결과 수 (숨긴 것 제외). 물품·날짜가 없으면 null (화면에서 숨김)
   * - newCount: 마지막 확인 이후 새로 들어온 후보 수 (→ "새 습득물 n건", ?new=1)
   */
  async function list(deviceId) {
    requireDeviceId(deviceId)
    const rows = await repo.listByDevice(deviceId)
    const allCounts = await Promise.all(rows.map((row) => countsOf(row.lostItem.id)))
    return {
      items: rows.map((row, i) => ({
        condition: toResponse(row.lostItem),
        lookupCode: row.lookupCode,
        searchedAt: row.searchedAt,
        resultCount: allCounts[i]?.resultCount ?? null,
        newCount: allCounts[i]?.newCount ?? 0,
      })),
    }
  }

  /** 이 기기의 기록 전체 삭제 (분실물·조회 코드는 남아서 코드로 다시 열 수 있다) */
  async function clear(deviceId) {
    requireDeviceId(deviceId)
    return { deleted: await repo.deleteByDevice(deviceId) }
  }

  return { record, list, clear }
}
