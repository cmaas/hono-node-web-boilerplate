import type { Account, PaginatedAccounts } from '../domain/account.js';
import type { Tombstone } from '../domain/tombstone.js';
import { db } from '../infrastructure/db.js';
import { generateSecureToken, hashPassword } from '../utils/util.js';

export function getAccountByEmail(email: string): Account | null {
	const row = <Account>db.prepare('SELECT * FROM accounts WHERE email COLLATE NOCASE = ?').get(email);
	if (!row) {
		return null;
	}
	return {
		id: row.id,
		created: row.created,
		updated: row.updated,
		email: row.email,
		password: row.password,
		emailVerified: row.emailVerified,
		role: row.role,
	};
}

export function getAccount(id: string): Account | null {
	const row = <Account>db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
	if (!row) {
		return null;
	}
	return {
		id: row.id,
		created: row.created,
		updated: row.updated,
		email: row.email,
		password: row.password,
		emailVerified: row.emailVerified,
		role: row.role,
	};
}

export async function createAccount(email: string, password: string | null = null): Promise<Account> {
	const pw = password || generateSecureToken(24);
	const account: Account = {
		id: generateSecureToken(13),
		created: Date.now(),
		updated: 0,
		email,
		password: await hashPassword(pw),
		emailVerified: 0,
		role: 'user',
	};
	db.prepare('INSERT INTO accounts (id, created, updated, email, password, emailVerified) VALUES (?, ?, ?, ?, ?, ?)').run(account.id, account.created, account.updated, account.email, account.password, account.emailVerified);
	return account;
}

export function updateAccount(account: Account): boolean {
	const result = db.prepare('UPDATE accounts SET email = ?, updated = ?, emailVerified = ? WHERE id = ?').run(account.email, Date.now(), account.emailVerified, account.id);
	return result.changes > 0;
}

export async function updateAccountPassword(id: string, newPassword: string): Promise<boolean> {
	const hashedPassword = await hashPassword(newPassword);
	const result = db.prepare('UPDATE accounts SET password = ?, updated = ? WHERE id = ?').run(hashedPassword, Date.now(), id);
	return result.changes > 0;
}

export function terminateAllSessionsForAccount(accountId: string): void {
	db.prepare('DELETE FROM tokens WHERE accountId = ? AND type = ?').run(accountId, 'session');
}

export function deleteAccountAndCreateTombstone(account: Account): Tombstone | null {
	const tombstone: Tombstone = {
		id: account.id,
		email: account.email,
		reason: 'user_deleted',
		created: account.created,
		deleted: Date.now(),
		pruned: 0,
	};

	const insertTombstone = db.prepare('INSERT INTO tombstones (id, email, reason, created, deleted, pruned) VALUES (?, ?, ?, ?, ?, ?)');
	const deleteAccountStmt = db.prepare('DELETE FROM accounts WHERE id = ?');

	try {
		db.transaction(() => {
			insertTombstone.run(tombstone.id, tombstone.email, tombstone.reason, tombstone.created, tombstone.deleted, tombstone.pruned);
			deleteAccountStmt.run(account.id);
		})();
		return tombstone;
	} catch (e) {
		console.error('Failed to delete account:', e);
		return null;
	}
}

export function getRecentAccounts(page = 1, perPage = 50): PaginatedAccounts {
	const offset = (page - 1) * perPage;

	const countResult = db.prepare('SELECT COUNT(*) as count FROM accounts').get() as { count: number };
	const totalCount = countResult?.count || 0;

	const rows = <Array<Account>>db.prepare('SELECT * FROM accounts ORDER BY created DESC LIMIT ?, ?').all(offset, perPage);

	return {
		accounts: rows || [],
		totalCount,
	};
}

export function searchAccounts(query: string, page = 1, perPage = 50): PaginatedAccounts {
	if (!query || query.trim() === '') {
		return getRecentAccounts(page, perPage);
	}

	const trimmedQuery = query.trim();
	const searchPattern = `%${trimmedQuery}%`;
	const offset = (page - 1) * perPage;

	const countSql = `SELECT COUNT(*) as count FROM accounts WHERE email LIKE ? OR id LIKE ? OR role LIKE ?`;
	const countResult = db.prepare(countSql).get(searchPattern, searchPattern, searchPattern) as { count: number };
	const totalCount = countResult?.count || 0;

	const sql = `SELECT * FROM accounts WHERE email LIKE ? OR id LIKE ? OR role LIKE ? ORDER BY created DESC LIMIT ?, ?`;
	const rows = <Array<Account>>db.prepare(sql).all(searchPattern, searchPattern, searchPattern, offset, perPage);

	return {
		accounts: rows || [],
		totalCount,
	};
}
