import type { HttpBindings } from '@hono/node-server';
import { type Context, Hono, type Next } from 'hono';
import { type Account, getAccount } from './models/account.js';
import { searchAccounts } from './models/admin.js';
import type { SessionPayload } from './models/token.js';
import { AdminAccountDetailsView, AdminView } from './views/admin-view.js';
import { ErrorRedirectLogin } from './views/error-redirect-login.js';
import { ErrorView } from './views/generic.js';

type Bindings = HttpBindings & {
	/* ... */
};

const app = new Hono<{ Bindings: Bindings; Variables: { session: SessionPayload; account: Account } }>();

const requireAdminAccount = async (c: Context, next: Next) => {
	const account = c.get('account');
	if (!account) {
		return c.html(ErrorRedirectLogin(), 401);
	}
	if (account.role !== 'admin') {
		return c.html(ErrorView({ message: 'You need admin privileges to access this page.' }), 403);
	}
	return next();
};

// here we are in a sub-app of Hono, actual route for this is: /admin
app.get('/', requireAdminAccount, (c) => {
	const q = c.req.query('q');
	const searchResults = searchAccounts(q || '') || [];
	return c.html(AdminView({ accounts: searchResults, query: q || '' }));
});

app.get('/account-details', requireAdminAccount, (c) => {
	const id = c.req.query('id');
	if (!id) {
		return c.html(ErrorView({ message: 'No account ID provided.' }), 400);
	}
	const account = getAccount(id);
	if (!account) {
		return c.html(ErrorView({ message: 'Account not found.' }), 404);
	}
	return c.html(AdminAccountDetailsView({ account }));
});

export default app;
