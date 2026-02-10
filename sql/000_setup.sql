BEGIN TRANSACTION;

DROP TABLE IF EXISTS "accounts";
CREATE TABLE accounts (
    id TEXT PRIMARY KEY,              			-- string ID
    created INTEGER NOT NULL DEFAULT 0,         -- UNIX timestamp
    updated INTEGER NOT NULL DEFAULT 0,         -- UNIX timestamp
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    emailVerified INTEGER NOT NULL DEFAULT 0, 	-- UNIX timestamp, 0 if not verified
	role TEXT NOT NULL DEFAULT 'user'  			-- "admin" or "user"
);

DROP TABLE IF EXISTS "tokens";
CREATE TABLE tokens (
	id	TEXT PRIMARY KEY,             			-- string ID
	created INTEGER NOT NULL,         			-- UNIX timestamp
	expires INTEGER NOT NULL DEFAULT 0, 		-- UNIX timestamp
	accountId TEXT NOT NULL,
	"type"	TEXT NOT NULL,						-- see TokenType
	payload	TEXT NOT NULL DEFAULT ''  			-- JSON string
);

DROP TABLE IF EXISTS "account_events";
CREATE TABLE "account_events" (
	"id"	INTEGER PRIMARY KEY,
	"accountId"	TEXT,							-- NULL for system events
	"type"	TEXT NOT NULL DEFAULT '',			-- event type, e.g. 'account_created', 'account_login_failed'
	"data"	TEXT NOT NULL DEFAULT '',			-- JSON with ok, message, and additional context
	"created"	INTEGER NOT NULL				-- UNIX timestamp
);

CREATE INDEX IF NOT EXISTS idx_account_events_account ON account_events (accountId, created DESC);
CREATE INDEX IF NOT EXISTS idx_account_events_type ON account_events (type, created DESC);

DROP TABLE IF EXISTS "tombstones";
CREATE TABLE tombstones (
    id TEXT PRIMARY KEY,
    email TEXT,
    reason TEXT DEFAULT 'user_deleted',
    created INTEGER NOT NULL,
    deleted INTEGER NOT NULL,
    pruned INTEGER NOT NULL DEFAULT 0
);

DROP TABLE IF EXISTS "trivial_passwords";
CREATE TABLE "trivial_passwords" (
	"password"	TEXT NOT NULL UNIQUE,
	PRIMARY KEY("password")
);

DROP TABLE IF EXISTS "config";
CREATE TABLE "config" (
	"key"	TEXT NOT NULL UNIQUE,
	"type"  TEXT NOT NULL,
	"value"	TEXT NOT NULL,
	PRIMARY KEY("key")
);

COMMIT;
