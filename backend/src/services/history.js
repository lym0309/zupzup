// 기기별 검색 기록 (GET/DELETE /api/history). 분실물을 등록하면 그 기기의 기록에 추가된다
import { isDeviceId } from '../rules/deviceId.js'
import { toResponse } from './lostItems.js'

const httpError = (status, message) => Object.assign(new Error(message), { status })

function requireDeviceId(deviceId) {
  if (!isDeviceId(deviceId)) throw httpError(400, '기기 정보가 없어요. 페이지를 새로고침해 주세요.')
}

export function createHistoryService({ repo, lookupCodes }) {
  /** 이 기기의 기록에 분실물 추가 + 조회 코드 발급 (기록 카드에 코드가 보이도록) */
  async function record(deviceId, lostItemId) {
    requireDeviceId(deviceId)
    await repo.upsert(deviceId, lostItemId)
    await lookupCodes.issue(lostItemId)
  }

  /**
   * 이 기기의 기록, 최근 검색 순
   * - resultCount: 매칭 결과 API(#24) 머지 후 채운다. 그 전까지 null (화면에서 숨김)
   * - newCount: 새 후보 API(new-candidates) 구현 후 채운다. 그 전까지 0
   */
  async function list(deviceId) {
    requireDeviceId(deviceId)
    const rows = await repo.listByDevice(deviceId)
    return {
      items: rows.map((row) => ({
        condition: toResponse(row.lostItem),
        lookupCode: row.lookupCode,
        searchedAt: row.searchedAt,
        resultCount: null,
        newCount: 0,
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
