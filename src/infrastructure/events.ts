import { db } from './db.js';

// --- Event Types ---
export type AuditEventType =
	// Security-relevant
	| 'account_reset_password_requested'
	| 'account_password_changed'
	| 'account_email_changed'
	| 'account_email_verified'
	| 'account_login_failed'
	| 'account_invalid_password'

	// Account lifecycle
	| 'account_created'
	| 'account_create_failed'
	| 'account_deleted'
	| 'account_delete_failed'

	// System (no account)
	| 'cron_cleanup_completed'
	| 'system_error';

// Severity levels (const int, not enum)
export const AuditLevel = {
	OK: 0,
	INFO: 1,
	WARN: 2,
	ERROR: 3,
	CRITICAL: 4,
} as const;
export type AuditLevelValue = (typeof AuditLevel)[keyof typeof AuditLevel];

const levelLabels: Record<AuditLevelValue, string> = {
	0: 'ok',
	1: 'info',
	2: 'warn',
	3: 'error',
	4: 'critical',
};

export function getLevelLabel(level: AuditLevelValue): string {
	return levelLabels[level] ?? 'unknown';
}

// Standard data fields - message is expected, rest is flexible
export interface AuditEventData {
	message?: string;
	[key: string]: unknown;
}

export interface AuditEvent {
	id?: number;
	accountId: string | null;
	type: AuditEventType;
	level: AuditLevelValue;
	data: AuditEventData;
	created: number;
}

// --- Handlers ---
type Handler = (event: AuditEvent) => void | Promise<void>;

const handlers: Partial<Record<AuditEventType, Handler[]>> = {
	// Configure reactions for each event type - all in one place
	// example: account_login_failed: [checkBruteForce],
};

function runHandlers(event: AuditEvent) {
	const eventHandlers = handlers[event.type] ?? [];
	for (const handler of eventHandlers) {
		try {
			handler(event);
		} catch (err) {
			console.error(`[audit] Handler error for ${event.type}:`, err);
		}
	}
}

// --- Persistence ---
function persist(event: AuditEvent): number {
	const stmt = db.prepare('INSERT INTO audit_events (accountId, type, level, data, created) VALUES (?, ?, ?, ?, ?)');
	const result = stmt.run(event.accountId, event.type, event.level, JSON.stringify(event.data), event.created);
	return result.lastInsertRowid as number;
}

// --- Public API ---

/**
 * Record an audit event. Logs sync to stdout, persists async via setImmediate.
 *
 * @param type - Event type
 * @param accountId - Account ID, or null for system events
 * @param level - Severity level (AuditLevel.OK, WARN, ERROR, etc.)
 * @param data - Event data, optionally `message` for summary
 */
export function audit(type: AuditEventType, accountId: string | null, level: AuditLevelValue, data: AuditEventData = {}): void {
	// 1. Log immediately (sync) - we want this even if the rest fails
	const label = getLevelLabel(level);
	const logPrefix = level >= AuditLevel.WARN ? `[audit] [${label}]` : `[audit]`;
	console.log(`${logPrefix} ${type}`, { accountId, ...data });

	// 2. Persist and run handlers async (fire-and-forget)
	setImmediate(() => {
		try {
			const event: AuditEvent = {
				accountId,
				type,
				level,
				data,
				created: Date.now(),
			};

			event.id = persist(event);
			runHandlers(event);
		} catch (err) {
			console.error(`[audit] Failed to persist/handle ${type}:`, err);
		}
	});
}

// --- Query API (for admin dashboard) ---

interface AuditEventRow {
	id: number;
	accountId: string | null;
	type: AuditEventType;
	level: number;
	data: string;
	created: number;
}

function rowToEvent(row: AuditEventRow): AuditEvent {
	return {
		id: row.id,
		accountId: row.accountId,
		type: row.type,
		level: row.level as AuditLevelValue,
		data: JSON.parse(row.data),
		created: row.created,
	};
}

export function getEventsForAccount(accountId: string, options?: { limit?: number; offset?: number }): AuditEvent[] {
	const limit = options?.limit ?? 50;
	const offset = options?.offset ?? 0;
	const rows = db.prepare('SELECT * FROM audit_events WHERE accountId = ? ORDER BY created DESC LIMIT ? OFFSET ?').all(accountId, limit, offset) as AuditEventRow[];
	return rows.map(rowToEvent);
}

export function getSystemEvents(options?: { limit?: number; offset?: number }): AuditEvent[] {
	const limit = options?.limit ?? 50;
	const offset = options?.offset ?? 0;
	const rows = db.prepare('SELECT * FROM audit_events WHERE accountId IS NULL ORDER BY created DESC LIMIT ? OFFSET ?').all(limit, offset) as AuditEventRow[];
	return rows.map(rowToEvent);
}

export function countRecentEvents(type: AuditEventType, accountId: string | null, since: number): number {
	const stmt = accountId === null ? db.prepare('SELECT COUNT(*) as count FROM audit_events WHERE type = ? AND accountId IS NULL AND created > ?') : db.prepare('SELECT COUNT(*) as count FROM audit_events WHERE type = ? AND accountId = ? AND created > ?');
	const result = (accountId === null ? stmt.get(type, since) : stmt.get(type, accountId, since)) as { count: number };
	return result.count;
}
