import { db } from '../db.js';
import { generateSecureToken, hashPassword } from '../util.js';

export type AccountRole = 'admin' | 'user';

export interface Account {
	id: string;
	created: number;
	updated: number;
	email: string;
	password: string;
	emailVerified: number;
	role: AccountRole
}

export function getAccountByEmail(email: string): Account | null {
	const row = <Account>db.prepare('SELECT * FROM accounts WHERE email = ?').get(email);
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
		role: row.role
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
		role: row.role
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
		role: 'user'
	}
	db.prepare('INSERT INTO accounts (id, created, updated, email, password, emailVerified) VALUES (?, ?, ?, ?, ?, ?)')
		.run(account.id, account.created, account.updated, account.email, account.password, account.emailVerified);
	return account;
}

export function updateAccount(account: Account): boolean {
	const result = db.prepare('UPDATE accounts SET email = ?, updated = ?, emailVerified = ? WHERE id = ?')
		.run(account.email, Date.now(), account.emailVerified, account.id);
	return result.changes > 0;
}

export async function updateAccountPassword(id: string, newPassword: string): Promise<boolean> {
	const hashedPassword = await hashPassword(newPassword);
	const result = db.prepare('UPDATE accounts SET password = ?, updated = ? WHERE id = ?')
		.run(hashedPassword, Date.now(), id);
	return result.changes > 0;
}

export function terminateAllSessionsForAccount(accountId: string): void {
	db.prepare('DELETE FROM tokens WHERE accountId = ? AND type = ?')
		.run(accountId, 'session');
}
