-- "내 물건이 아니에요"로 숨긴 습득물 (분실물별)
-- 매칭 결과(GET /api/lost-items/:id/results)와 신규 후보(new-candidates)에서 뺀다.
-- 분실물 기준이라 조회 코드로 다른 기기에서 열어도 똑같이 숨겨진다.
CREATE TABLE hidden_items (
  lost_item_id  CHAR(16)    CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'lostItemId',
  atc_id        VARCHAR(30) NOT NULL COMMENT '습득물 관리번호 atcId',
  fd_sn         VARCHAR(10) NOT NULL COMMENT '습득 순번 fdSn',
  created_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (lost_item_id, atc_id, fd_sn),
  CONSTRAINT fk_hidden_items_lost_item FOREIGN KEY (lost_item_id) REFERENCES lost_items (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci
  COMMENT = '분실물별로 숨긴 습득물';
