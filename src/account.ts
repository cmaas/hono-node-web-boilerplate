import type { HttpBindings } from '@hono/node-server';
import { type Context, Hono, type Next } from 'hono';
import { EMAIL_VERIFY, sendEmail } from './email.js';
import { EVENTS, eventBus } from './index.js';
import { type Account, getAccountByEmail, terminateAllSessionsForAccount, updateAccount, updateAccountPassword } from './models/account.js';
import { createSessionToken, createVerifyEmailToken, deleteSessionToken, getSessionTokensForAccount, type SessionPayload, type SessionToken } from './models/token.js';
import { clearSessionCookie, initSessionCookie } from './plugins/server-session.js';
import { isSamePassword, isValidEmail, satisfiesPasswordPolicy } from './util.js';
import { AccountView, ChangeEmailForm, ChangePasswordForm } from './views/account-view.js';
import { ErrorRedirectLogin } from './views/error-redirect-login.js';
import { ErrorView, SuccessView } from './views/generic.js';

type Bindings = HttpBindings & {
	/* ... */
};

const app = new Hono<{ Bindings: Bindings; Variables: { session: SessionPayload, account: Account } }>();

// Middleware to require a logged-in account
export const requireAccount = async (c: Context, next: Next) => {
	const account = c.get('account');
	if (!account) {
		return c.html(ErrorRedirectLogin(), 401);
	}
	return next();
};

// here we are in a sub-app of Hono, actual route for this is: /account
app.get('/', requireAccount, (c) => {
	const account = <Account>c.get('account');
	const session = <SessionToken>c.get('session');
	const activeSessions = getSessionTokensForAccount(account.id);
	return c.html(AccountView({ account, session, activeSessions }));
});

// example of a route that requires a verified email
app.get('/special', requireAccount, (c) => {
	const account = <Account>c.get('account');
	if (account.emailVerified <= 0) {
		return c.html(ErrorView({ message: 'You need to verify your email address to access this page.' }));
	}
	return c.html(SuccessView({ message: 'Welcome to the special page that only users with verified email addresses are allowed to see.' }));
});

// --- LOGOUT ---
app.post('/logout', requireAccount, async (c) => {
	const session = <SessionToken>c.get('session');
	deleteSessionToken(session.id);
	clearSessionCookie(c);
	return c.redirect('/');
});

app.post('/logout/all', requireAccount, async (c) => {
	const session = <SessionToken>c.get('session');
	terminateAllSessionsForAccount(session.accountId);
	clearSessionCookie(c);
	return c.redirect('/');
});

// --- REVOKE SESSION ---
app.post('/revoke-session/:sessionId', requireAccount, async (c) => {
	const account = <Account>c.get('account');
	const currentSession = <SessionToken>c.get('session');
	const sessionIdToRevoke = c.req.param('sessionId');

	// Verify that the session belongs to the current account
	const sessionsForAccount = getSessionTokensForAccount(account.id);
	const sessionExists = sessionsForAccount.some(s => s.id === sessionIdToRevoke);
	if (!sessionExists) {
		return c.html(ErrorView({ message: 'Session not found or does not belong to your account.' }), 404);
	}

	if (sessionIdToRevoke === currentSession.id) {
		clearSessionCookie(c);
	}
	deleteSessionToken(sessionIdToRevoke);
	return c.redirect('/account');
});

/**
 * Email verification step 1: If the user didn't receive a "verify your email" yet, they can request another email while logged in.
 * - Rate limit in web server config!
 */
app.post('/request-verification', requireAccount, async (c) => {
	const account = <Account>c.get('account');
	const token = createVerifyEmailToken(account.id, account.email);
	sendEmail(account.email, EMAIL_VERIFY.subject, EMAIL_VERIFY.body(token.id));

	return c.html(SuccessView({ message: `We've send you an email to verify your email address.` }));
});



app.get('/change-password', requireAccount, (c) => {
	return c.html(ChangePasswordForm({ values: {}, errors: [] }));
});

app.post('/change-password', requireAccount, async (c) => {
	const account = <Account>c.get('account');
	const body = await c.req.parseBody();
	const password = (<string>body.password).trim();
	const currentPassword = (<string>body.currentPassword).trim();
	if (!password || !currentPassword) {
		return c.html(ChangePasswordForm({ values: { password, currentPassword }, errors: [{ field: 'password', message: 'Please provide both current and new password' }] }));
	}
	const isCorrectPassword = await isSamePassword(account.password, currentPassword);
	if (!isCorrectPassword) {
		return c.html(ChangePasswordForm({ values: { password, currentPassword }, errors: [{ field: 'currentPassword', message: 'Current password is incorrect' }] }));
	}
	if (!satisfiesPasswordPolicy(password)) {
		return c.html(ChangePasswordForm({ values: { password, currentPassword }, errors: [{ field: 'password', message: 'New password must have at least 8 characters and should not be trivial' }] }));
	}

	const result = await updateAccountPassword(account.id, password);
	if (!result) {
		return c.html(ErrorView({ message: 'Failed to update password. Please send a message to our customer support.' }));
	}
	clearSessionCookie(c);
	terminateAllSessionsForAccount(account.id);
	const session = createSessionToken(account.id, { userAgent: c.req.header('User-Agent') || '' }); // server
	initSessionCookie(c, session); // client

	return c.html(SuccessView({ message: 'Your password has been changed' }));
});

app.get('/change-email', requireAccount, (c) => {
	return c.html(ChangeEmailForm({ values: {}, errors: [] }));
});

app.post('/change-email', requireAccount, async (c) => {
	const account = <Account>c.get('account');
	const body = await c.req.parseBody();
	const email = (<string>body.email).trim();
	const currentPassword = (<string>body.currentPassword).trim();
	if (!email || !currentPassword) {
		return c.html(ChangeEmailForm({ values: { email, currentPassword }, errors: [{ field: 'email', message: 'Please provide both email and new password' }] }));
	}
	if (!isValidEmail(email)) {
		return c.html(ChangeEmailForm({ values: { email, currentPassword }, errors: [{ field: 'email', message: 'Invalid email address' }] }));
	}
	const isCorrectPassword = await isSamePassword(account.password, currentPassword);
	if (!isCorrectPassword) {
		return c.html(ChangeEmailForm({ values: { email, currentPassword }, errors: [{ field: 'currentPassword', message: 'Current password is incorrect' }] }));
	}
	if (getAccountByEmail(email)) {
		return c.html(ChangeEmailForm({ values: { email, currentPassword }, errors: [{ field: 'email', message: 'Email is already in use' }] }));
	}
	// note: a more sophisticated flow for changing the email address is described here:
	// https://owasp.org/www-community/pages/controls/Changing_Registered_Email_Address_For_An_Account
	const oldEmail = account.email;
	account.email = email;
	account.emailVerified = 0; // need to re-verify email
	const result = await updateAccount(account);
	if (!result) {
		return c.html(ErrorView({ message: 'Failed to change email address. Please send a message to our customer support.' }));
	}

	const token = createVerifyEmailToken(account.id, account.email);
	sendEmail(account.email, EMAIL_VERIFY.subject, EMAIL_VERIFY.body(token.id));
	eventBus.emit(EVENTS.ACCOUNT_CHANGED_EMAIL, { accountId: account.id, from: oldEmail, to: account.email, timestamp: Date.now() });

	return c.html(SuccessView({ message: 'Your email address has been changed' }));
});

export default app;