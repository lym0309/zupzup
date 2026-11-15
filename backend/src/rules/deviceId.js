// 기기 ID (검색 기록을 기기 단위로 나누는 값)
// 프론트가 처음 접속할 때 무작위로 만들어 localStorage에 두고, X-Device-Id 헤더로 보낸다
export const DEVICE_ID_HEADER = 'x-device-id'

const DEVICE_ID = /^[A-Za-z0-9_-]{16,64}$/

/** 형식에 맞는 기기 ID인지 (UUID 등 16~64자 영문·숫자·-·_) */
export const isDeviceId = (value) => typeof value === 'string' && DEVICE_ID.test(value)
