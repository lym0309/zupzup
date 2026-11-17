// 매칭 후보 조회: 수집기(#27)가 저장한 found_items에서 날짜·분류(또는 물품명)로 후보를 고른다.
// 경찰청 API를 요청마다 부르지 않아 빠르고, API 호출 한도도 쓰지 않는다.

// 한 번에 읽는 최대 줄 수 (메모리 192MB). 날짜·분류로 거르면 보통 수백~수천 건
export const MAX_CANDIDATES = 20_000

// LIKE 검색어 안의 % _ \ 를 글자 그대로 찾게
const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`)

/**
 * @param {{ fromYmd: string, toYmd: string, category?: string|null, nameKeywords?: string[] }} q
 *   날짜는 YYYY-MM-DD. category가 없으면 물품명 키워드 중 하나라도 들어간 것만
 */
export function buildCandidatesQuery({ fromYmd, toYmd, category = null, nameKeywords = [] }) {
  const where = ['gone_at IS NULL', 'fd_ymd BETWEEN ? AND ?']
  const params = [fromYmd, toYmd]
  if (category) {
    where.push('category = ?')
    params.push(category)
  } else if (nameKeywords.length > 0) {
    where.push(`(${nameKeywords.map(() => 'fd_prdt_nm LIKE ?').join(' OR ')})`)
    params.push(...nameKeywords.map((k) => `%${escapeLike(k)}%`))
  }
  const sql = `SELECT atc_id, fd_sn, fd_prdt_nm, prdt_cl_nm, clr_nm, fd_ymd, reg_ymd, dep_place, img_url,
                      region, detail_fd_place, detail_org_nm
                 FROM found_items
                WHERE ${where.join(' AND ')}
                ORDER BY reg_ymd DESC, atc_id DESC
                LIMIT ${MAX_CANDIDATES}`
  return { sql, params }
}

// 테이블 한 줄 → 점수 계산에 쓰는 모양 (목록 API 필드명 + 지역·상세)
export const fromRow = (r) => ({
  atcId: r.atc_id,
  fdSn: r.fd_sn,
  fdPrdtNm: r.fd_prdt_nm,
  prdtClNm: r.prdt_cl_nm,
  clrNm: r.clr_nm,
  fdYmd: r.fd_ymd,
  regYmd: r.reg_ymd,
  depPlace: r.dep_place,
  fdFilePathImg: r.img_url,
  region: r.region,
  fdPlace: r.detail_fd_place ?? '',
  orgNm: r.detail_org_nm ?? '',
})

export function createMatchCandidatesRepo(pool) {
  async function find(query) {
    const { sql, params } = buildCandidatesQuery(query)
    const [rows] = await pool.query(sql, params)
    return rows.map(fromRow)
  }
  return { find }
}
