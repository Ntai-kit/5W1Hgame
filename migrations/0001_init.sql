-- 時刻はすべて UNIX 時刻のミリ秒
CREATE TABLE players (
  id TEXT PRIMARY KEY,
  nickname TEXT,
  created_at INTEGER NOT NULL,
  banned_at INTEGER
);

CREATE TABLE parts (
  id INTEGER PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('when', 'where', 'who', 'why', 'how', 'what')),
  text TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('seed', 'sync')),
  player_id TEXT REFERENCES players(id),
  hidden INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX parts_category_visible ON parts(category, hidden);

CREATE TABLE sentences (
  id INTEGER PRIMARY KEY,
  mode TEXT NOT NULL CHECK (mode IN ('gacha', 'sync')),
  when_part_id INTEGER NOT NULL REFERENCES parts(id),
  where_part_id INTEGER NOT NULL REFERENCES parts(id),
  who_part_id INTEGER NOT NULL REFERENCES parts(id),
  why_part_id INTEGER NOT NULL REFERENCES parts(id),
  how_part_id INTEGER NOT NULL REFERENCES parts(id),
  what_part_id INTEGER NOT NULL REFERENCES parts(id),
  like_count INTEGER NOT NULL DEFAULT 0,
  counted INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
-- ガチャの文は、6つの部分の組み合わせが同じなら1つにまとめる
CREATE UNIQUE INDEX sentences_gacha_combo
  ON sentences(when_part_id, where_part_id, who_part_id, why_part_id, how_part_id, what_part_id)
  WHERE mode = 'gacha';

CREATE TABLE likes (
  sentence_id INTEGER NOT NULL REFERENCES sentences(id),
  player_id TEXT NOT NULL REFERENCES players(id),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (sentence_id, player_id)
);

CREATE TABLE reports (
  id INTEGER PRIMARY KEY,
  part_id INTEGER NOT NULL REFERENCES parts(id),
  reporter_id TEXT NOT NULL REFERENCES players(id),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'hidden', 'ng_added', 'dismissed')),
  created_at INTEGER NOT NULL,
  UNIQUE (part_id, reporter_id)
);

-- その人が最後に引いた組み合わせ。いいねはこの組み合わせにだけ押せる
CREATE TABLE last_draws (
  player_id TEXT PRIMARY KEY REFERENCES players(id),
  when_part_id INTEGER NOT NULL,
  where_part_id INTEGER NOT NULL,
  who_part_id INTEGER NOT NULL,
  why_part_id INTEGER NOT NULL,
  how_part_id INTEGER NOT NULL,
  what_part_id INTEGER NOT NULL,
  drawn_at INTEGER NOT NULL
);

-- 回数の上限を数えるための記録
CREATE TABLE action_log (
  player_id TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX action_log_lookup ON action_log(player_id, action, created_at);
