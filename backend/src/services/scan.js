// 경찰청 목록을 기간 내 끝까지 한 페이지씩 받아 콜백에 넘긴다.
// 5,000건 응답 하나가 파싱 후 약 10MB라, 메모리(192MB)를 위해 출처별로 한 페이지씩만 받는다.
export const SCAN_ROWS = 5000

/**
 * @param {{ listFoundItems: Function }} policeApi
 * @param {'police'|'portal'} source
 * @param {object} base  listFoundItems 조건 (pageNo·numOfRows 제외)
 * @param {(items: object[]) => void} onPage
 */
export async function scanPages(policeApi, source, base, onPage) {
  let pages = 1
  for (let pageNo = 1; pageNo <= pages; pageNo++) {
    const res = await policeApi.listFoundItems(source, { ...base, pageNo, numOfRows: SCAN_ROWS })
    pages = Math.ceil(res.totalCount / SCAN_ROWS)
    onPage(res.items)
  }
}
