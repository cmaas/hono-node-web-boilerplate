/**
 * Hono Node Web Boilerplate
 * =========================
 *
 * If you use this boilerplate, you have to consider several aspects:
 * - critical routes should be rate-limited in your web server / proxy config (e.g. nginx, Cloudflare, etc.)
 * - set up cron jobs to clean up expired tokens, old sessions etc.
 * - config: email server, email templates, timeouts for tokens/sessions
 * - CSRF mitigation strategy: cookies are set with SameSite=Lax, actions that change state must be POST requests
 */

import { type HttpBindings, serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { GlobalConfig } from './config.js';
import type { Account } from './domain/account.js';
import type { SessionToken } from './domain/token.js';
import { sessionMiddleware } from './plugins/server-session.js';
import accountApp from './routes/account-routes.js';
import adminApp from './routes/admin-routes.js';
import cronApp from './routes/cron-routes.js';
import visitorApp from './routes/visitor-routes.js';

type Bindings = HttpBindings & {
	/* ... */
};

// --- SETUP ---
const app = new Hono<{ Bindings: Bindings; Variables: { session: SessionToken; account: Account } }>();
app.use(logger());
app.use('*', sessionMiddleware());
app.use('/*', serveStatic({ root: './public' }));

app.onError((err, c) => {
	console.error('[app.onError]', err);
	return c.text(`Internal Server Error: ${err.message}`, 500);
});

// --- ROUTES ---
app.route('/', visitorApp);
app.route('/', accountApp);
app.route('/', adminApp);
app.route('/', cronApp);

// Export the app for testing
export { app };

// Only start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
	const port = GlobalConfig.SERVER_PORT;
	console.log(`Server started: ${new Date().toLocaleString()}, running on http://localhost:${port}`);

	serve({
		fetch: app.fetch,
		port,
	});
}
