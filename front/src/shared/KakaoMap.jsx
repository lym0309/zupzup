import { useEffect, useMemo, useRef, useState } from 'react'
import './KakaoMap.css'

/**
 * 카카오맵 + 보관장소 핀 (상세 4a: 핀 1개 / 매칭 결과 1a: 핀 여러 개)
 * - VITE_KAKAO_JS_KEY가 없거나 좌표가 없으면 시안처럼 빈 지도 자리 + 가운데 핀을 보여준다.
 * - 핀: 선택 28px 주색, 나머지 18px, 흰 테두리 3px
 *
 * 사용 예:
 *   <KakaoMap height={300} label={orgNm} pins={[{ id, lat, lng, selected: true }]} />
 *
 * @param {{ height: number, label?: string,
 *           pins: { id: string, lat: number, lng: number, selected?: boolean, title?: string }[],
 *           onSelect?: (id: string) => void }} props
 */
export default function KakaoMap({ height, label = '', pins = [], onSelect }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const overlaysRef = useRef([])
  const [sdk, setSdk] = useState(null) // 로드된 kakao.maps
  const [failed, setFailed] = useState(false)
  const hasKey = Boolean(import.meta.env.VITE_KAKAO_JS_KEY)
  // 렌더마다 새 배열이 생기지 않도록 내용 기준으로 고정
  const pinsKey = JSON.stringify(pins)
  const located = useMemo(
    () => JSON.parse(pinsKey).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)),
    [pinsKey],
  )

  // SDK 로드 (키가 있고 좌표가 있을 때만)
  useEffect(() => {
    if (!hasKey || located.length === 0) return
    let cancelled = false
    loadKakaoSdk()
      .then((maps) => !cancelled && setSdk(maps))
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [hasKey, located.length])

  // 지도 생성 + 핀 그리기
  useEffect(() => {
    if (!sdk || !containerRef.current || located.length === 0) return
    const selected = located.find((p) => p.selected) ?? located[0]
    const center = new sdk.LatLng(selected.lat, selected.lng)
    if (!mapRef.current) {
      mapRef.current = new sdk.Map(containerRef.current, { center, level: 4 })
    } else {
      mapRef.current.panTo(center)
    }

    overlaysRef.current.forEach((o) => o.setMap(null))
    overlaysRef.current = located.map((p) => {
      const el = document.createElement('button')
      el.type = 'button'
      el.className = `kakao-map__pin${p.selected ? ' is-selected' : ''}`
      el.title = p.title ?? ''
      el.setAttribute('aria-label', p.title ? `${p.title} 위치` : '보관장소 위치')
      if (onSelect) el.addEventListener('click', () => onSelect(p.id))
      const overlay = new sdk.CustomOverlay({
        position: new sdk.LatLng(p.lat, p.lng),
        content: el,
        zIndex: p.selected ? 2 : 1,
      })
      overlay.setMap(mapRef.current)
      return overlay
    })
    // 핀이 여러 개면 모두 보이게
    if (located.length > 1) {
      const bounds = new sdk.LatLngBounds()
      located.forEach((p) => bounds.extend(new sdk.LatLng(p.lat, p.lng)))
      mapRef.current.setBounds(bounds)
    }
  }, [sdk, located, onSelect])

  const showPlaceholder = !hasKey || failed || located.length === 0

  return (
    <div className="kakao-map" style={{ height }}>
      {showPlaceholder ? (
        <div className="kakao-map__placeholder" role="img" aria-label={label ? `지도 · ${label}` : '지도'}>
          <span className="kakao-map__caption">지도{label ? ` · ${label}` : ''}</span>
          {pins.length > 0 && <span className="kakao-map__pin is-selected kakao-map__pin--center" />}
          <span className="kakao-map__notice">
            {!hasKey ? '카카오 지도 키(VITE_KAKAO_JS_KEY)를 설정하면 지도가 보여요' : failed ? '지도를 불러오지 못했어요' : '위치 정보를 찾지 못했어요'}
          </span>
        </div>
      ) : (
        <div ref={containerRef} className="kakao-map__canvas" />
      )}
    </div>
  )
}

// 카카오맵 SDK는 페이지에 한 번만 넣는다
let sdkPromise = null
function loadKakaoSdk() {
  if (window.kakao?.maps?.Map) return Promise.resolve(window.kakao.maps)
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(import.meta.env.VITE_KAKAO_JS_KEY)}&autoload=false`
      script.async = true
      script.onload = () => window.kakao.maps.load(() => resolve(window.kakao.maps))
      script.onerror = () => {
        sdkPromise = null
        reject(new Error('카카오맵 SDK 로드 실패'))
      }
      document.head.appendChild(script)
    })
  }
  return sdkPromise
}
