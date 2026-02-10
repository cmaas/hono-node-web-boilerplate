import type { Account, PaginatedAccounts } from '../domain/account.js';
import { db } from '../infrastructure/db.js';

export function getRecentAccounts(page = 1, perPage = 50): PaginatedAccounts {
	const offset = (page - 1) * perPage;

	// Get total count
	const countResult = db.prepare('SELECT COUNT(*) as count FROM accounts').get() as { count: number };
	const totalCount = countResult?.count || 0;

	// Get paginated results
	const rows = <Array<Account>>db.prepare('SELECT * FROM accounts ORDER BY created DESC LIMIT ?, ?').all(offset, perPage);

	return {
		accounts: rows || [],
		totalCount,
	};
}

export function searchAccounts(query: string, page = 1, perPage = 50): PaginatedAccounts {
	// If no query provided, return recent accounts
	if (!query || query.trim() === '') {
		return getRecentAccounts(page, perPage);
	}

	const trimmedQuery = query.trim();
	const searchPattern = `%${trimmedQuery}%`;
	const offset = (page - 1) * perPage;

	// Get total count for search
	const countSql = `SELECT COUNT(*) as count FROM accounts WHERE email LIKE ? OR id LIKE ? OR role LIKE ?`;
	const countResult = db.prepare(countSql).get(searchPattern, searchPattern, searchPattern) as { count: number };
	const totalCount = countResult?.count || 0;

	// Get paginated search results
	const sql = `SELECT * FROM accounts WHERE email LIKE ? OR id LIKE ? OR role LIKE ? ORDER BY created DESC LIMIT ?, ?`;
	const rows = <Array<Account>>db.prepare(sql).all(searchPattern, searchPattern, searchPattern, offset, perPage);

	return {
		accounts: rows || [],
		totalCount,
	};
}
