-- 신규 후보 (GET /api/lost-items/:id/new-candidates)
-- 신규 후보 = 마지막 확인 이후 처음 수집된(found_items.first_seen_at) 매칭 결과 중, 본 후보·숨긴 후보를 뺀 것
-- 분실물 기준이라 조회 코드로 다른 기기에서 열어도 똑같이 보인다

-- 매칭 결과(1a)를 마지막으로 확인한 시각. NULL이면 아직 확인 전 → 검색을 등록한 시각(created_at) 이후를 신규로 본다
ALTER TABLE lost_items
  ADD COLUMN last_viewed_at DATETIME NULL COMMENT '매칭 결과를 마지막으로 확인한 시각 (신규 후보 판정용)' AFTER feature;

-- 신규 후보 중 상세를 열어 본 습득물 → 다음 조회부터 신규에서 빠지고 이전 결과로 간다
CREATE TABLE seen_items (
  lost_item_id  CHAR(16)    CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'lostItemId',
  atc_id        VARCHAR(30) NOT NULL COMMENT '습득물 관리번호 atcId',
  fd_sn         VARCHAR(10) NOT NULL COMMENT '습득 순번 fdSn',
  created_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (lost_item_id, atc_id, fd_sn),
  CONSTRAINT fk_seen_items_lost_item FOREIGN KEY (lost_item_id) REFERENCES lost_items (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci
  COMMENT = '분실물별로 상세를 본 신규 후보';
