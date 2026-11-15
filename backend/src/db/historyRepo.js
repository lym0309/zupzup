// search_history 테이블 저장·조회
import { fromRow as lostItemFromRow } from './lostItemsRepo.js'

// DB는 KST(+09:00) 문자열로 준다 (pool: dateStrings) → ISO 시각
const toIso = (value) => (value ? `${value.replace(' ', 'T')}+09:00` : null)

export function createHistoryRepo(pool) {
  // 같은 분실물을 다시 기록하면 검색 시각만 새로
  async function upsert(deviceId, lostItemId) {
    await pool.execute(
      `INSERT INTO search_history (device_id, lost_item_id) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE searched_at = CURRENT_TIMESTAMP`,
      [deviceId, lostItemId],
    )
  }

  /** 이 기기의 기록, 최근 검색 순. 분실물 조건과 조회 코드를 함께 */
  async function listByDevice(deviceId) {
    const [rows] = await pool.execute(
      `SELECT li.*, lc.code AS lookup_code, sh.searched_at, sh.last_viewed_at
         FROM search_history sh
         JOIN lost_items li ON li.id = sh.lost_item_id
         LEFT JOIN lookup_codes lc ON lc.lost_item_id = sh.lost_item_id
        WHERE sh.device_id = ?
        ORDER BY sh.searched_at DESC, li.id`,
      [deviceId],
    )
    return rows.map((row) => ({
      lostItem: lostItemFromRow(row),
      lookupCode: row.lookup_code ?? null,
      searchedAt: toIso(row.searched_at),
      lastViewedAt: toIso(row.last_viewed_at),
    }))
  }

  async function deleteByDevice(deviceId) {
    const [result] = await pool.execute('DELETE FROM search_history WHERE device_id = ?', [deviceId])
    return result.affectedRows
  }

  return { upsert, listByDevice, deleteByDevice }
}
