import { describe, expect, it } from 'vitest'
import { colorFamily, isSimilarColor } from '../../src/rules/colors.js'
import {
  categoryScore,
  nameMatches,
  colorScore,
  dateScore,
  regionKeywords,
  provinceOf,
  regionScore,
  scoreItem,
} from '../../src/rules/score.js'

describe('categoryScore', () => {
  it('소분류까지 일치 100 / 대분류만 55 / 불일치 0', () => {
    expect(categoryScore('전자기기 > 무선이어폰', '전자기기 > 무선이어폰')).toBe(100)
    expect(categoryScore('전자기기 > 무선이어폰', '전자기기 > 스마트워치')).toBe(55)
    expect(categoryScore('전자기기 > 무선이어폰', '지갑 > 여성용 지갑')).toBe(0)
  })

  it('사용자가 대분류만 골랐으면 대분류 일치로 100', () => {
    expect(categoryScore('지갑', '지갑 > 남성용 지갑')).toBe(100)
  })

  it('정보가 없으면 null', () => {
    expect(categoryScore('', '지갑 > 남성용 지갑')).toBeNull()
    expect(categoryScore(undefined, '지갑')).toBeNull()
  })

  it('물품명이 있으면: 대분류 + 물품명(습득물 이름·소분류) 일치 100 / 대분류만 55 / 불일치 0', () => {
    const name = '에어팟 프로 케이스'
    expect(categoryScore('전자기기', '전자기기 > 무선이어폰', name, '에어팟프로')).toBe(100) // 습득물 이름
    expect(categoryScore('전자기기', '전자기기 > 무선이어폰', '무선이어폰', '이어폰')).toBe(100) // 소분류
    expect(categoryScore('전자기기', '전자기기 > 태블릿', name, '아이패드')).toBe(55)
    expect(categoryScore('전자기기', '지갑 > 남성용 지갑', name, '에어팟 케이스 지갑')).toBe(0)
    expect(categoryScore('전자기기', '전자기기 > 무선이어폰', 'AirPods', 'airpods pro')).toBe(100) // 대소문자 무시
  })

  it('분류 조건 없이 물품명만 있으면: 맞으면 100, 아니면 null', () => {
    expect(categoryScore(null, '전자기기 > 무선이어폰', '에어팟', '에어팟')).toBe(100)
    expect(categoryScore(null, '전자기기 > 태블릿', '에어팟', '아이패드')).toBeNull()
  })
})

describe('nameMatches', () => {
  it('1글자 단어는 빼고, 물품명이 없으면 null', () => {
    expect(nameMatches('폰', '휴대폰')).toBeNull()
    expect(nameMatches('', '휴대폰')).toBeNull()
    expect(nameMatches('검정 지갑', '반지갑')).toBe(true)
    expect(nameMatches('에어팟', '갤럭시버즈', '전자기기 > 무선이어폰')).toBe(false)
  })
})

describe('colorScore', () => {
  it('같은 계열 100 / 비슷한 계열 60 / 다른 계열 10', () => {
    expect(colorScore('검정', '블랙(검정)')).toBe(100)
    expect(colorScore('검정', '로열블루(밝은남)')).toBe(60) // 검정 ↔ 남색
    expect(colorScore('검정', '레드(빨강)')).toBe(10)
  })

  it('경찰청 색상명끼리도 비교', () => {
    expect(colorScore('그레이(암회)', '라이트그레이(옅은회)')).toBe(100)
  })

  it('습득물 색이 기타이거나 조건이 없으면 null', () => {
    expect(colorScore('검정', '기타')).toBeNull()
    expect(colorScore('', '블랙(검정)')).toBeNull()
  })

  it('비슷한 계열은 양방향', () => {
    expect(isSimilarColor('남색', '검정')).toBe(true)
    expect(isSimilarColor('검정', '남색')).toBe(true)
    expect(isSimilarColor('검정', '노랑')).toBe(false)
  })

  it('colorFamily는 계열 이름도 그대로 받는다', () => {
    expect(colorFamily('흰색')).toBe('흰색')
    expect(colorFamily('화이트(흰)')).toBe('흰색')
  })
})

describe('dateScore', () => {
  it('분실 기간 안 100, 하루 뒤 95, 이후 하루마다 8점 감점 (최소 0)', () => {
    expect(dateScore('2026-11-05', '2026-11-05', '2026-11-05')).toBe(100)
    expect(dateScore('2026-11-03', '2026-11-05', '2026-11-04')).toBe(100)
    expect(dateScore('2026-11-05', '2026-11-05', '2026-11-06')).toBe(95)
    expect(dateScore('2026-11-05', '2026-11-05', '2026-11-07')).toBe(87)
    expect(dateScore('2026-11-05', '2026-11-05', '2026-11-10')).toBe(63)
    expect(dateScore('2026-11-05', '2026-11-05', '2026-12-05')).toBe(0)
  })

  it('분실일보다 먼저 습득: 하루 전 50, 그 이전 10', () => {
    expect(dateScore('2026-11-05', '2026-11-05', '2026-11-04')).toBe(50)
    expect(dateScore('2026-11-05', '2026-11-05', '2026-11-01')).toBe(10)
  })

  it('dateTo가 없으면 dateFrom 하루로', () => {
    expect(dateScore('2026-11-05', '', '2026-11-06')).toBe(95)
  })

  it('정보가 없으면 null', () => {
    expect(dateScore('', '', '2026-11-05')).toBeNull()
  })
})

describe('regionScore', () => {
  it('regionKeywords: 시·도와 끝말(구·역·동 등)을 떼고 2글자 이상만', () => {
    expect(regionKeywords('서울 강남구 역삼역')).toEqual(['강남', '역삼'])
    expect(regionKeywords('경기도 성남시')).toEqual(['성남'])
    expect(regionKeywords('서울특별시')).toEqual([])
    expect(regionKeywords('서울 지하철 2호선')).toEqual(['지하철', '2호선'])
  })

  it('장소에 키워드가 있으면 100', () => {
    expect(regionScore({ region: '서울 강남구' }, { depPlace: '강남경찰서' })).toBe(100)
    expect(regionScore({ region: '서울 역삼역' }, { depPlace: '보관소', fdPlace: '역삼역 2번 출구' })).toBe(100)
  })

  it('구·역까지 적었는데 키워드는 없고 시·도만 같으면 60, 시·도가 다르면 10', () => {
    expect(regionScore({ region: '서울 강남구' }, { depPlace: '용강지구대', region: '서울' })).toBe(60)
    expect(regionScore({ region: '서울 강남구' }, { depPlace: '용강지구대' }, { sameProvince: true })).toBe(60)
    expect(regionScore({ region: '서울 강남구' }, { depPlace: '서면지구대', region: '부산' })).toBe(10)
  })

  it('시·도만 골랐으면 같은 시·도 100 (더 자세히 비교할 수 없음), 다르면 10', () => {
    expect(regionScore({ region: '서울' }, { depPlace: '용강지구대', region: '서울' })).toBe(100)
    expect(regionScore({ region: '서울' }, { depPlace: '서면지구대', region: '부산' })).toBe(10)
  })

  it('판단할 수 없으면 null: 사용자 지역 없음, 습득물 시·도 모름(광주·전남 LCG000 등)', () => {
    expect(regionScore({ region: '' }, { depPlace: '용강지구대', region: '서울' })).toBeNull()
    expect(regionScore({ region: null }, { depPlace: '용강지구대' })).toBeNull()
    expect(regionScore({ region: '광주' }, { depPlace: '목포경찰서', region: null })).toBeNull()
  })

  it('provinceOf', () => {
    expect(provinceOf('서울 강남구')).toBe('서울')
    expect(provinceOf('경기')).toBe('경기')
    expect(provinceOf('어딘가')).toBeNull()
    expect(provinceOf(null)).toBeNull()
  })
})

describe('scoreItem', () => {
  const condition = {
    prdtClNm: '전자기기 > 무선이어폰', clrNm: '검정', region: '서울 강남구',
    dateFrom: '2026-11-05', dateTo: '2026-11-05',
  }

  it('조건별 점수와 가중 평균 (35·20·25·20)', () => {
    const item = { prdtClNm: '전자기기 > 무선이어폰', clrNm: '블랙(검정)', fdYmd: '2026-11-06', depPlace: '용강지구대' }
    const { score, tags } = scoreItem(condition, item, { sameProvince: true })
    expect(tags).toEqual([
      { key: 'category', score: 100 },
      { key: 'color', score: 100 },
      { key: 'date', score: 95 },
      { key: 'region', score: 60 },
    ])
    expect(score).toBe(Math.round((100 * 35 + 100 * 20 + 95 * 25 + 60 * 20) / 100)) // 91
  })

  it('정보 없는 조건은 빼고 나머지 가중치로 평균', () => {
    const item = { prdtClNm: '전자기기 > 무선이어폰', clrNm: '기타', fdYmd: '2026-11-05', depPlace: '강남경찰서' }
    const { score, tags } = scoreItem(condition, item)
    expect(tags.find((t) => t.key === 'color').score).toBeNull()
    expect(score).toBe(100)
  })

  it('물품명이 맞는 습득물이 같은 대분류의 다른 물건보다 높다 (#44 리뷰)', () => {
    const cond = { itemName: '에어팟 프로 케이스', prdtClNm: '전자기기', clrNm: '검정', dateFrom: '2026-11-05' }
    const base = { clrNm: '블랙(검정)', fdYmd: '2026-11-05' }
    const earbuds = scoreItem(cond, { ...base, fdPrdtNm: '에어팟 프로', prdtClNm: '전자기기 > 무선이어폰' })
    const tablet = scoreItem(cond, { ...base, fdPrdtNm: '아이패드', prdtClNm: '전자기기 > 태블릿' })
    expect(earbuds.score).toBe(100)
    expect(tablet.tags[0]).toEqual({ key: 'category', score: 55 })
    expect(tablet.score).toBeLessThan(earbuds.score)
  })

  it('조건이 하나도 없으면 0', () => {
    expect(scoreItem({ dateFrom: '' }, { prdtClNm: '', clrNm: '', fdYmd: '' }).score).toBe(0)
  })
})
