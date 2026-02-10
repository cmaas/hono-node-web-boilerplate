import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

// Allow environment-specific database configuration
const getDatabasePath = () => {
	if (process.env.NODE_ENV === 'test') {
		return process.env.TEST_DB_PATH || ':memory:';
	}
	return process.env.DB_PATH || './data.db';
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
	// Initialize database schema from SQL file
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = dirname(__filename);
	const schemaPath = resolve(__dirname, '../../sql/000_setup.sql');
	const schemaSql = readFileSync(schemaPath, 'utf8');
	db.exec(schemaSql);
}

initializeSchema();
