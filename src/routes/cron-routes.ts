import type { HttpBindings } from '@hono/node-server';
import { Hono } from 'hono';
import { bearerAuth } from 'hono/bearer-auth';
import { GlobalConfig } from '../config.js';
import type { Account } from '../domain/account.js';
import type { SessionPayload } from '../domain/token.js';
import { audit } from '../infrastructure/events.js';
import { deleteExpiredTokens } from '../repositories/cron-repository.js';

type Bindings = HttpBindings & {
	/* ... */
};

const app = new Hono<{ Bindings: Bindings; Variables: { session: SessionPayload; account: Account } }>();

app.post('/cron/delete-expired-tokens', bearerAuth({ token: GlobalConfig.CRON_API_TOKEN }), (c) => {
	const deletedCount = deleteExpiredTokens();
	audit('cron_cleanup_completed', null, { ok: true, message: `Deleted ${deletedCount} expired tokens` });
	return c.json({ deleted: deletedCount });
});

export default app;
