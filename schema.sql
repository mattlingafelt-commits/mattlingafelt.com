-- D1 database mattlingafelt-ratings (binding DB). Apply with:
-- npx wrangler@4 d1 execute mattlingafelt-ratings --remote --file schema.sql
CREATE TABLE IF NOT EXISTS ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  robot TEXT NOT NULL CHECK (robot IN ('01','02','03','04','05','06','07','08','09','10')),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 10),
  reason TEXT CHECK (reason IS NULL OR length(reason) <= 400),
  day TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','hidden'))
);
CREATE INDEX IF NOT EXISTS ratings_robot ON ratings (robot);

-- Rate limit only: a one-way hash of the connection's IP and today's random salt, with a count.
-- Never joined to ratings; wiped (with the salt) when the next day's first rating comes in.
CREATE TABLE IF NOT EXISTS throttle (k TEXT PRIMARY KEY, n INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS salt (day TEXT PRIMARY KEY, value TEXT NOT NULL);
