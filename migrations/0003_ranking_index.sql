-- ランキングを、いいねの多い順に読むための索引
CREATE INDEX sentences_ranking ON sentences(like_count DESC, created_at, id);
