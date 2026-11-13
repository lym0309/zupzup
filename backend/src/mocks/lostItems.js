// mock: 분실물 검색 조건 저장소 (@lym0309의 POST /api/lost-items · DB 테이블이 생기면 삭제)
// 매칭 결과 API를 미리 확인하기 위한 고정 조건. 날짜는 오늘 기준으로 계산해 항상 결과가 나오게 한다.
import { addDays, todayKst } from '../rules/foundItemList.js'

const DEMOS = {
  // 결과가 많이 나오는 예: 검정 무선이어폰, 서울 강남구, 3일 전
  demo: (today) => ({
    rawText: '사흘 전 강남역 근처에서 검정 에어팟 프로 케이스를 잃어버렸어요',
    itemName: '무선이어폰 케이스',
    prdtClNm: '전자기기 > 무선이어폰',
    clrNm: '검정',
    region: '서울 강남구',
    lctCd: 'LCA000',
    dateFrom: addDays(today, -3),
    dateTo: addDays(today, -3),
  }),
  // 대분류만 입력한 예: 갈색 지갑, 서울, 최근 일주일 중
  'demo-wallet': (today) => ({
    rawText: '지난주에 서울에서 갈색 반지갑을 잃어버렸어요',
    itemName: '반지갑',
    prdtClNm: '지갑',
    clrNm: '갈색',
    region: '서울',
    lctCd: 'LCA000',
    dateFrom: addDays(today, -7),
    dateTo: addDays(today, -5),
  }),
  // 결과가 없는 예 (빈 상태 1b 확인용)
  'demo-empty': (today) => ({
    rawText: '어제 제주에서 보라색 바이올린을 잃어버렸어요',
    itemName: '바이올린',
    prdtClNm: '악기 > 현악기',
    clrNm: '보라',
    region: '제주 서귀포시',
    lctCd: 'LCP000',
    dateFrom: addDays(today, -1),
    dateTo: addDays(today, -1),
  }),
}

export function createMockLostItems({ now = () => new Date() } = {}) {
  return {
    /** @returns {Promise<object|null>} SearchCondition */
    async get(lostItemId) {
      const make = DEMOS[lostItemId]
      return make ? { lostItemId, ...make(todayKst(now())) } : null
    },
  }
}
