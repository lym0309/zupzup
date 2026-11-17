// mock: GET /api/lost-items/:id/new-candidates (신규 후보 API가 생기면 삭제)
// lostItemId가 'mock-empty'면 새 습득물 0건(6b)을 돌려준다

const NO_IMG = 'https://www.lost112.go.kr/lostnfs/images/sub/img02_no_img.gif'

const tags = (category, color, date, region) => [
  { key: 'category', score: category },
  { key: 'color', score: color },
  { key: 'date', score: date },
  { key: 'region', score: region },
]

// 신규 후보: 마지막 확인 이후 처음 나타난 습득물 (regYmd = 접수일)
const NEW_ITEMS = [
  {
    atcId: 'F2026111500123', fdSn: '1', fdPrdtNm: '흰색 무선이어폰 케이스', prdtClNm: '전자기기 > 무선이어폰',
    clrNm: '화이트(흰색)', fdYmd: '2026-11-13', regYmd: '2026-11-15', depPlace: '강남경찰서',
    fdFilePathImg: NO_IMG, score: 92, tags: tags(100, 100, 90, 75), isNew: true,
    location: { lat: 37.5095, lng: 127.0671 },
  },
  {
    atcId: 'F2026111600456', fdSn: '1', fdPrdtNm: '이어폰 케이스', prdtClNm: '전자기기 > 기타',
    clrNm: '아이보리(흰색)', fdYmd: '2026-11-14', regYmd: '2026-11-16', depPlace: '서울교통공사 시청역 유실물센터',
    fdFilePathImg: NO_IMG, score: 74, tags: tags(70, 80, 85, 60), isNew: true,
    location: { lat: 37.5657, lng: 126.9769 },
  },
]

// 이전에 확인한 결과 (간단한 행 목록)
const PREVIOUS_ITEMS = [
  {
    atcId: 'F2026111300011', fdSn: '1', fdPrdtNm: '무선이어폰 (에어팟)', prdtClNm: '전자기기 > 무선이어폰',
    clrNm: '화이트(흰색)', fdYmd: '2026-11-12', depPlace: '서초경찰서',
    fdFilePathImg: NO_IMG, score: 81, tags: tags(100, 100, 80, 45), isNew: false,
    location: { lat: 37.4837, lng: 127.0324 },
  },
  {
    atcId: 'F2026111300087', fdSn: '2', fdPrdtNm: '이어폰', prdtClNm: '전자기기 > 무선이어폰',
    clrNm: '블랙(검정)', fdYmd: '2026-11-12', depPlace: '서울교통공사 강남역',
    fdFilePathImg: NO_IMG, score: 63, tags: tags(100, 30, 80, 80), isNew: false,
    location: { lat: 37.4979, lng: 127.0276 },
  },
  {
    atcId: 'F2026111200302', fdSn: '1', fdPrdtNm: '케이스', prdtClNm: '기타물품 > 기타',
    clrNm: '화이트(흰색)', fdYmd: '2026-11-11', depPlace: '송파경찰서',
    fdFilePathImg: NO_IMG, score: 48, tags: tags(40, 100, 60, 30), isNew: false,
    location: { lat: 37.5013, lng: 127.1166 },
  },
]

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms))

export async function mockGetNewCandidates(lostItemId) {
  await delay()
  return {
    lostItemId,
    condition: {
      lostItemId,
      rawText: '(mock) 어제 저녁 2호선 강남역에서 흰색 무선이어폰 케이스를 잃어버렸어요',
      extracted: true,
      itemName: '무선이어폰 케이스',
      prdtClNm: '전자기기',
      clrNm: '흰색',
      region: '서울',
      dateFrom: '2026-11-12',
      dateTo: '2026-11-13',
      brand: null,
      feature: null,
    },
    lookupCode: 'FND-7K2Q-48',
    lastViewedAt: '2026-11-14T21:40:00+09:00',
    newItems: lostItemId === 'mock-empty' ? [] : NEW_ITEMS,
    previousItems: PREVIOUS_ITEMS,
  }
}
