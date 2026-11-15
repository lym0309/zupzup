// 기기 ID: 검색 기록을 기기 단위로 나누는 무작위 값 (로그인 없음)
// 처음 접속할 때 만들어 localStorage에 두고, API 요청마다 X-Device-Id 헤더로 보낸다
const STORAGE_KEY = 'zupzup.deviceId'
const DEVICE_ID = /^[A-Za-z0-9_-]{16,64}$/ // 백엔드 rules/deviceId.js와 같은 기준

let memoryId = null // localStorage를 못 쓰는 브라우저: 이 탭에서만 유지

const newId = () => crypto.randomUUID()

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
