import type { HttpBindings } from '@hono/node-server';
import { Hono } from 'hono';
import { bearerAuth } from 'hono/bearer-auth';
import { GlobalConfig } from './config.js';
import type { Account } from './models/account.js';
import { deleteExpiredTokens } from './models/cron.js';
import type { SessionPayload } from './models/token.js';

type Bindings = HttpBindings & {
	/* ... */
};

const app = new Hono<{ Bindings: Bindings; Variables: { session: SessionPayload; account: Account } }>();

// here we are in a sub-app of Hono, actual route for this is: /admin
app.post('/delete-expired-tokens', bearerAuth({ token: GlobalConfig.CRON_API_TOKEN }), (c) => {
	const deletedCount = deleteExpiredTokens();
	return c.json({ deleted: deletedCount });
});

export default app;
