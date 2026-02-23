import type { HttpBindings } from '@hono/node-server';
import { type Context, Hono, type Next } from 'hono';
import type { Account } from '../domain/account.js';
import type { SessionPayload } from '../domain/token.js';
import { getAccount } from '../repositories/account-repository.js';
import { searchAccounts } from '../repositories/admin-repository.js';
import { simpleEscapeString } from '../utils/util.js';
import { AdminAccountDetailsView, AdminView } from '../views/admin-view.js';
import { ErrorRedirectLogin } from '../views/error-redirect-login.js';
import { ErrorView } from '../views/generic.js';

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

app.get('/admin', requireAdminAccount, (c) => {
	const q = simpleEscapeString(c.req.query('q'));
	const pageParam = c.req.query('page');
	const page = pageParam ? Math.max(1, Number.parseInt(pageParam, 10)) : 1;

	const resultsPerPage = 25;
	const result = searchAccounts(q, page, resultsPerPage);
	const totalPages = Math.ceil(result.totalCount / resultsPerPage);

	return c.html(
		AdminView({
			accounts: result.accounts,
			query: q,
			page,
			totalPages,
			totalCount: result.totalCount,
		}),
	);
});

app.get('/admin/account-details', requireAdminAccount, (c) => {
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
