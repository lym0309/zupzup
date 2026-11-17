-- 조회 코드 · 검색 기록 (검색 기록 화면 5a)

-- 조회 코드: 다른 기기에서 같은 검색을 열 때 쓰는 코드 (FND-XXXX-XX, 0/O·1/I 제외). lostItemId와 1:1
CREATE TABLE lookup_codes (
  code          CHAR(11) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '조회 코드 FND-XXXX-XX',
  lost_item_id  CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'lostItemId',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (code),
  UNIQUE KEY uk_lost_item (lost_item_id),
  CONSTRAINT fk_lookup_codes_lost_item FOREIGN KEY (lost_item_id) REFERENCES lost_items (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci
  COMMENT = '조회 코드';

-- 검색 기록: 기기(프론트 localStorage의 deviceId) 단위로 어떤 분실물을 검색했는지
-- last_viewed_at은 새 후보 판정(마지막 조회 이후 처음 나타난 습득물)에 쓴다
CREATE TABLE search_history (
  device_id       VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '기기 ID (프론트가 만든 무작위 값)',
  lost_item_id    CHAR(16)    CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'lostItemId',
  searched_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '검색한 시각',
  last_viewed_at  DATETIME NULL COMMENT '결과를 마지막으로 본 시각 (새 후보 판정용)',
  PRIMARY KEY (device_id, lost_item_id),
  INDEX idx_device_searched (device_id, searched_at),
  CONSTRAINT fk_search_history_lost_item FOREIGN KEY (lost_item_id) REFERENCES lost_items (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci
  COMMENT = '기기별 검색 기록';
