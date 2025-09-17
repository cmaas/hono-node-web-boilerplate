import { db } from '../db.js';
import type { Account } from './account.js';

export function getRecentAccounts(page = 1, perPage = 50): Array<Account> | null {
	const rows = <Array<Account>> db.prepare('SELECT * FROM accounts ORDER BY created DESC LIMIT ?, ?').all((page - 1) * perPage, perPage);
	if (! rows) {
		return null;
	}
	return rows;
}

export function searchAccounts(query: string, page = 1, perPage = 50): Array<Account> | null {
	// If no query provided, return recent accounts
	if (!query || query.trim() === '') {
		return getRecentAccounts(page, perPage);
	}

	const trimmedQuery = query.trim();
	const searchPattern = `%${trimmedQuery}%`;
	const sql = `SELECT * FROM accounts WHERE email LIKE ? OR id LIKE ? OR role LIKE ? ORDER BY created DESC LIMIT ?, ?`;
	const rows = <Array<Account>> db.prepare(sql).all(searchPattern, searchPattern, searchPattern, (page - 1) * perPage, perPage);
	if (!rows) {
		return null;
	}
	return rows;
}