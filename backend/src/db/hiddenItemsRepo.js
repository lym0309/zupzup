// hidden_items 테이블: "내 물건이 아니에요"로 숨긴 습득물 (분실물별)
// 매칭 결과와 신규 후보(@kwonminsooo)에서 같이 쓴다: listKeys(lostItemId)로 뺄 목록을 받는다

export const hiddenKey = (atcId, fdSn) => `${atcId}-${fdSn}`

export function createHiddenItemsRepo(pool) {
  /** 숨기기 (이미 숨겼으면 그대로) */
  async function hide(lostItemId, atcId, fdSn) {
    await pool.execute('INSERT IGNORE INTO hidden_items (lost_item_id, atc_id, fd_sn) VALUES (?, ?, ?)', [
      lostItemId,
      atcId,
      fdSn,
    ])
  }

  /** 숨기기 취소 (숨긴 적 없으면 그대로) */
  async function unhide(lostItemId, atcId, fdSn) {
    await pool.execute('DELETE FROM hidden_items WHERE lost_item_id = ? AND atc_id = ? AND fd_sn = ?', [
      lostItemId,
      atcId,
      fdSn,
    ])
  }

  /** @returns {Promise<Set<string>>} "atcId-fdSn" 모음 */
  async function listKeys(lostItemId) {
    const [rows] = await pool.execute('SELECT atc_id, fd_sn FROM hidden_items WHERE lost_item_id = ?', [lostItemId])
    return new Set(rows.map((r) => hiddenKey(r.atc_id, r.fd_sn)))
  }

  return { hide, unhide, listKeys }
}
