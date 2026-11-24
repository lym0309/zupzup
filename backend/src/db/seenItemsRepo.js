// seen_items 테이블: 신규 후보 중 상세를 열어 본 습득물 (분실물별)
// lost_items.last_viewed_at(마지막 확인 시각)도 여기서 읽고 쓴다 (둘 다 신규 후보 판정용)
import { hiddenKey } from './hiddenItemsRepo.js'

export function createSeenItemsRepo(pool) {
  /** 본 후보로 기록 (이미 있으면 그대로) */
  async function markSeen(lostItemId, atcId, fdSn) {
    await pool.execute('INSERT IGNORE INTO seen_items (lost_item_id, atc_id, fd_sn) VALUES (?, ?, ?)', [
      lostItemId,
      atcId,
      fdSn,
    ])
  }

  /** @returns {Promise<Set<string>>} "atcId:fdSn" 모음 */
  async function listKeys(lostItemId) {
    const [rows] = await pool.execute('SELECT atc_id, fd_sn FROM seen_items WHERE lost_item_id = ?', [lostItemId])
    return new Set(rows.map((r) => hiddenKey(r.atc_id, r.fd_sn)))
  }

  /**
   * 신규 판정 기준 시각 (DB 문자열 'YYYY-MM-DD HH:MM:SS', KST)
   * @returns {Promise<{ lastViewedAt: string|null, createdAt: string } | null>} 분실물이 없으면 null
   */
  async function viewState(lostItemId) {
    const [rows] = await pool.execute('SELECT last_viewed_at, created_at FROM lost_items WHERE id = ?', [lostItemId])
    return rows[0] ? { lastViewedAt: rows[0].last_viewed_at ?? null, createdAt: rows[0].created_at } : null
  }

  /** 마지막 확인 시각 = 지금 */
  async function markViewed(lostItemId) {
    await pool.execute('UPDATE lost_items SET last_viewed_at = CURRENT_TIMESTAMP WHERE id = ?', [lostItemId])
  }

  return { markSeen, listKeys, viewState, markViewed }
}
