// lookup_codes 테이블 저장·조회

export function createLookupCodesRepo(pool) {
  async function findByLostItemId(lostItemId) {
    const [rows] = await pool.execute('SELECT code FROM lookup_codes WHERE lost_item_id = ?', [lostItemId])
    return rows[0]?.code ?? null
  }

  async function findByCode(code) {
    const [rows] = await pool.execute('SELECT lost_item_id FROM lookup_codes WHERE code = ?', [code])
    return rows[0]?.lost_item_id ?? null
  }

  /**
   * 코드 저장 시도 → 이 분실물에 저장된 코드 (없으면 null)
   * - 같은 분실물에 이미 코드가 있으면 기존 코드 (동시에 두 번 발급돼도 하나만 남는다)
   * - 다른 분실물이 이미 쓰는 코드면 저장되지 않아 null → 서비스가 새 코드로 다시 시도
   */
  async function insert(code, lostItemId) {
    await pool.execute(
      `INSERT INTO lookup_codes (code, lost_item_id) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE lost_item_id = lost_item_id`,
      [code, lostItemId],
    )
    return findByLostItemId(lostItemId)
  }

  return { findByLostItemId, findByCode, insert }
}
