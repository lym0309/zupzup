/**
 * "내 물건이 아니에요"로 숨긴 습득물 (분실물별, 이 기기 브라우저에만 저장)
 * 매칭 결과(1a)·신규 습득물(6a)에서 이 목록을 빼고 보여준다.
 *
 * TODO(@kim-ch2): 서버 저장으로 바꾸기 (#36 리뷰). 기기에만 두면 서버의 새 후보 수에 숨긴 것도 세지고,
 *   조회 코드로 다른 기기에서 열면 다시 보인다.
 *   → PUT/DELETE /api/lost-items/:id/hidden-items/:atcId/:fdSn (#24), 화면은 #25에서 교체
 */
const keyOf = (lostItemId) => `zupzup:hidden:${lostItemId}`
const itemKey = (atcId, fdSn) => `${atcId}-${fdSn}`

function read(storage, lostItemId) {
  try {
    const list = JSON.parse(storage.getItem(keyOf(lostItemId)) ?? '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return [] // 저장소를 못 쓰거나 값이 깨졌으면 숨긴 게 없는 것으로
  }
}

export function getHiddenItems(lostItemId, storage = globalThis.localStorage) {
  if (!lostItemId || !storage) return new Set()
  return new Set(read(storage, lostItemId))
}

export function hideItem(lostItemId, atcId, fdSn, storage = globalThis.localStorage) {
  if (!lostItemId || !storage) return
  const list = read(storage, lostItemId)
  const key = itemKey(atcId, fdSn)
  if (list.includes(key)) return
  try {
    storage.setItem(keyOf(lostItemId), JSON.stringify([...list, key]))
  } catch {
    // 저장 실패(사생활 보호 모드 등)는 무시: 이번 화면 이동에서만 숨겨지지 않을 뿐
  }
}

export const isHidden = (hidden, { atcId, fdSn }) => hidden.has(itemKey(atcId, fdSn))
