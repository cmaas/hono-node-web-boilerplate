import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { GlobalConfig } from '../config.js';

// Allow environment-specific database configuration
const getDatabasePath = () => {
	if (GlobalConfig.NODE_ENV === 'test') {
		return GlobalConfig.TEST_DB_PATH;
	}
	return GlobalConfig.DB_PATH;
};

export const initDb = (path?: string) => {
	const dbPath = path || getDatabasePath();
	const database = new Database(dbPath);
	console.log(`\x1b[97m✔ Opened DB:\x1b[0m \x1b[92m${dbPath}\x1b[0m`);
	database.pragma('journal_mode = WAL');
	return database;
};

// Global database instance - will be test db in test mode
export let db = initDb();

// Allow replacing the database instance (for testing)
export const setDb = (newDb: Database.Database) => {
	db = newDb;
};

function initializeSchema() {
	// Only initialize schema if 'accounts' table does not exist
	const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='accounts'").get();

	if (tableExists) {
		return;
	}

	const __filename = fileURLToPath(import.meta.url);
	const __dirname = dirname(__filename);

	// Initialize database schema
	const schemaPath = resolve(__dirname, '../../sql/000_setup.sql');
	db.exec(readFileSync(schemaPath, 'utf8'));

	// Seed config data
	const seedPath = resolve(__dirname, '../../sql/seed.sql');
	db.exec(readFileSync(seedPath, 'utf8'));

	// Load trivial passwords
	if (GlobalConfig.NODE_ENV === 'test') {
		seedTestTrivialPasswords();
	} else {
		loadTrivialPasswords(__dirname);
	}
}

// biome-ignore format: cleaner
const TEST_TRIVIAL_PASSWORDS = [
	'password', '12345678', 'qwerty123', 'abcdefgh', 'password1',
	'iloveyou', 'sunshine', 'princess', 'football', 'charlie',
	'letmein1', 'trustno1', 'welcome1', 'monkey12', 'dragon12',
	'master12', 'abc12345', 'mustang1', 'access14', 'asdfasdf',
];

function seedTestTrivialPasswords() {
	const stmt = db.prepare('INSERT OR IGNORE INTO trivial_passwords (password) VALUES (?)');
	for (const p of TEST_TRIVIAL_PASSWORDS) stmt.run(p);
}

function loadTrivialPasswords(__dirname: string) {
	const trivialPasswordsPath = GlobalConfig.TRIVIAL_PASSWORDS;
	if (!trivialPasswordsPath) {
		console.warn('⚠️  TRIVIAL_PASSWORDS environment variable not set - skipping password loading');
		return;
	}

	try {
		const filePath = resolve(__dirname, '../../', trivialPasswordsPath);
		const content = readFileSync(filePath, 'utf8');
		const passwords = content.split('\n').filter((line) => line.trim().length > 0);

		const insertStmt = db.prepare('INSERT OR IGNORE INTO trivial_passwords (password) VALUES (?)');
		const insertMany = db.transaction((passwords: string[]) => {
			for (const password of passwords) {
				insertStmt.run(password.toLowerCase().trim());
			}
		});

		insertMany(passwords);
		const count = db.prepare('SELECT COUNT(*) as count FROM trivial_passwords').get() as { count: number };
		console.log(`\x1b[97m✔ Loaded trivial passwords:\x1b[0m \x1b[92m${count.count} entries\x1b[0m`);
	} catch (error) {
		console.warn(`⚠️  Failed to load trivial passwords: ${error}`);
	}
}

// Initialize schema for the default database
initializeSchema();
