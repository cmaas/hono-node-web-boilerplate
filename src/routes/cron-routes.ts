import type { HttpBindings } from '@hono/node-server';
import { Hono } from 'hono';
import { bearerAuth } from 'hono/bearer-auth';
import { GlobalConfig } from '../config.js';
import type { Account } from '../domain/account.js';
import type { SessionTokenPayload } from '../domain/token.js';
import { AuditLevel, audit } from '../infrastructure/events.js';
import { deleteExpiredTokens } from '../repositories/cron-repository.js';

type Bindings = HttpBindings & {};

const app = new Hono<{ Bindings: Bindings; Variables: { session: SessionTokenPayload; account: Account } }>();

app.post('/cron/delete-expired-tokens', bearerAuth({ token: GlobalConfig.CRON_API_KEY }), (c) => {
	const deletedCount = deleteExpiredTokens();
	audit('cron_cleanup_completed', null, AuditLevel.OK, { message: `Deleted ${deletedCount} expired tokens` });
	return c.json({ deleted: deletedCount });
});

export default app;
