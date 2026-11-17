import { describe, expect, it } from 'vitest'
import { directionsUrl, isMobile, telUrl } from '../src/shared/kakaoLinks.js'

describe('kakaoLinks', () => {
  const location = { lat: 35.9, lng: 128.6 }

  it('좌표가 있으면 길찾기 링크', () => {
    expect(directionsUrl({ name: '광남자동차(주)', location })).toBe(
      'https://map.kakao.com/link/to/%EA%B4%91%EB%82%A8%EC%9E%90%EB%8F%99%EC%B0%A8(%EC%A3%BC),35.9,128.6',
    )
  })

  it('모바일은 카카오맵 앱 대중교통 경로', () => {
    expect(directionsUrl({ name: 'x', location, mobile: true })).toBe('kakaomap://route?ep=35.9,128.6&by=PUBLICTRANSIT')
  })

  it('좌표가 없으면 이름으로 검색', () => {
    expect(directionsUrl({ name: '서면지구대', location: null })).toBe(
      'https://map.kakao.com/link/search/%EC%84%9C%EB%A9%B4%EC%A7%80%EA%B5%AC%EB%8C%80',
    )
  })

  it('isMobile', () => {
    expect(isMobile('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true)
    expect(isMobile('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe(false)
  })

  it('telUrl: 숫자와 - 만, 없으면 null', () => {
    expect(telUrl('051-806-5854')).toBe('tel:051-806-5854')
    expect(telUrl(' 02) 2251-8202 ')).toBe('tel:022251-8202')
    expect(telUrl('')).toBeNull()
  })
})
