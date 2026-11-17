// 기기 ID: 검색 기록을 기기 단위로 나누는 무작위 값 (로그인 없음)
// 처음 접속할 때 만들어 localStorage에 두고, 기록이 필요한 API에만 X-Device-Id 헤더로 보낸다
// (모든 요청에 붙이면 배포 환경에서 요청마다 CORS preflight가 한 번 더 가서 느려진다)
const STORAGE_KEY = 'zupzup.deviceId'
const DEVICE_ID = /^[A-Za-z0-9_-]{16,64}$/ // 백엔드 rules/deviceId.js와 같은 기준

let memoryId = null // localStorage를 못 쓰는 브라우저: 이 탭에서만 유지

// randomUUID는 HTTPS·localhost에서만 있다. 휴대폰에서 http://192.168.x.x 로 접속하면 없어서 getRandomValues로 대신
export const newId = () =>
  crypto.randomUUID?.() ??
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('')

/** 기록이 필요한 요청(분실물 등록, 검색 기록)에만 붙이는 헤더 */
export const deviceHeaders = () => ({ 'X-Device-Id': getDeviceId() })

export function getDeviceId() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && DEVICE_ID.test(saved)) return saved
    const id = newId()
    localStorage.setItem(STORAGE_KEY, id)
    return id
  } catch {
    memoryId ??= newId()
    return memoryId
  }
}
