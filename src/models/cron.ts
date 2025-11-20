import { db } from '../db.js';

export function deleteExpiredTokens(): number {
	const now = Date.now();
	const result = db.prepare('DELETE FROM tokens WHERE expires < ?').run(now);
	return result.changes;
}
