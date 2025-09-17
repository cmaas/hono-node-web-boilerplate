CREATE TABLE accounts (
    id TEXT PRIMARY KEY,              			-- string ID
    created INTEGER NOT NULL DEFAULT 0,         -- UNIX timestamp
    updated INTEGER NOT NULL DEFAULT 0,         -- UNIX timestamp
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    emailVerified INTEGER NOT NULL DEFAULT 0, 	-- UNIX timestamp, 0 if not verified
	role TEXT NOT NULL DEFAULT 'user'  			-- "admin" or "user"
);

CREATE TABLE tokens (
	id	TEXT PRIMARY KEY,             			-- string ID
	created INTEGER NOT NULL,         			-- UNIX timestamp
	expires INTEGER NOT NULL DEFAULT 0, 		-- UNIX timestamp
	accountId TEXT NOT NULL,
	"type"	TEXT NOT NULL,						-- see TokenType
	payload	TEXT NOT NULL DEFAULT ''  			-- JSON string
);