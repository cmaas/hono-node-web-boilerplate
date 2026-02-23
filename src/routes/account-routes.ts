import type { HttpBindings } from '@hono/node-server';
import { type Context, Hono, type Next } from 'hono';
import type { Account } from '../domain/account.js';
import type { SessionToken, SessionTokenPayload } from '../domain/token.js';
import { AuditLevel, audit } from '../infrastructure/events.js';
import { clearPrivilegeElevation, clearSessionCookie, consumeSessionFlash, elevatePrivilege, initSessionCookie, isPrivilegeElevated, setSessionFlash } from '../plugins/server-session.js';
import { deleteAccountAndCreateTombstone, terminateAllSessionsForAccount } from '../repositories/account-repository.js';
import { createSessionToken, deleteSessionToken, getSessionTokensForAccount } from '../repositories/token-repository.js';
import * as AccountService from '../services/account-service.js';
import { isSamePassword, isValidEmail, simpleEscapeEmail, simpleEscapeString } from '../utils/util.js';
import { AccountView, ChangeEmailForm, ChangePasswordForm } from '../views/account-view.js';
import { DeleteAccountForm } from '../views/delete-account-view.js';
import { ElevateView } from '../views/elevate-view.js';
import { ErrorRedirectLogin } from '../views/error-redirect-login.js';
import { ErrorView, SuccessView } from '../views/generic.js';

type Bindings = HttpBindings & {
	/* ... */
};

const ELEVATED_ACTIONS = ['change-password', 'change-email', 'delete'] as const;
type ElevatedAction = (typeof ELEVATED_ACTIONS)[number];

const app = new Hono<{ Bindings: Bindings; Variables: { session: SessionTokenPayload; account: Account } }>();

// Middleware to require a logged-in account
export const requireAccount = async (c: Context, next: Next) => {
	const account = c.get('account');
	if (!account) {
		return c.html(ErrorRedirectLogin(), 401);
	}
	return next();
};

// NOT a middleware, but a guard function!
function requireElevation(c: Context, action: ElevatedAction) {
	const session = <SessionToken>c.get('session');
	if (isPrivilegeElevated(c, session)) return null;
	return c.redirect(`/account/elevate?next=${action}`);
}

// here we are in a sub-app of Hono, actual route for this is: /account
app.get('/account', requireAccount, (c) => {
	const account = <Account>c.get('account');
	const session = <SessionToken>c.get('session');
	const activeSessions = getSessionTokensForAccount(account.id);
	const flash = consumeSessionFlash(session) ?? undefined;
	return c.html(AccountView({ account, session, activeSessions, flash }));
});

// example of a route that requires a verified email
app.get('/account/special', requireAccount, (c) => {
	const account = <Account>c.get('account');
	if (account.emailVerified <= 0) {
		return c.html(ErrorView({ message: 'You need to verify your email address to access this page.' }));
	}
	return c.html(SuccessView({ message: 'Welcome to the special page that only users with verified email addresses are allowed to see.' }));
});

// --- LOGOUT ---
app.post('/account/logout', requireAccount, async (c) => {
	const session = <SessionToken>c.get('session');
	deleteSessionToken(session.id);
	clearSessionCookie(c);
	return c.redirect('/');
});

app.post('/account/logout/all', requireAccount, async (c) => {
	const session = <SessionToken>c.get('session');
	terminateAllSessionsForAccount(session.accountId);
	clearSessionCookie(c);
	return c.redirect('/');
});

// --- REVOKE SESSION ---
app.post('/account/revoke-session/:sessionId', requireAccount, async (c) => {
	const account = <Account>c.get('account');
	const currentSession = <SessionToken>c.get('session');
	const sessionIdToRevoke = c.req.param('sessionId');

	const sessionsForAccount = getSessionTokensForAccount(account.id);
	const sessionExists = sessionsForAccount.some((s) => s.id === sessionIdToRevoke);
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
 */
app.post('/account/request-verification', requireAccount, async (c) => {
	const account = <Account>c.get('account');
	const session = <SessionToken>c.get('session');
	await AccountService.requestVerificationEmail(account.id);
	setSessionFlash(session, { type: 'info', message: 'Verification email sent. Please also check your spam folder.' });
	return c.redirect('/account');
});

// --- ELEVATE PRIVILEGE ---
app.get('/account/elevate', requireAccount, (c) => {
	const session = <SessionToken>c.get('session');
	const next = simpleEscapeString(c.req.query('next'));
	if (!ELEVATED_ACTIONS.includes(next as ElevatedAction)) {
		return c.redirect('/account');
	}
	if (isPrivilegeElevated(c, session)) {
		return c.redirect(`/account/${next}`);
	}
	return c.html(ElevateView({ next }));
});

app.post('/account/elevate', requireAccount, async (c) => {
	const account = <Account>c.get('account');
	const session = <SessionToken>c.get('session');
	const body = await c.req.parseBody();
	const next = simpleEscapeString(body.next);
	const currentPassword = simpleEscapeString(body.currentPassword);

	if (!ELEVATED_ACTIONS.includes(next as ElevatedAction)) {
		return c.redirect('/account');
	}

	if (!currentPassword) {
		return c.html(ElevateView({ next, error: 'Please enter your current password' }));
	}

	const isCorrectPassword = await isSamePassword(account.password, currentPassword);
	if (!isCorrectPassword) {
		return c.html(ElevateView({ next, error: 'Password is incorrect' }));
	}

	elevatePrivilege(c, session);
	return c.redirect(`/account/${next}`);
});

// --- CHANGE PASSWORD ---
app.get('/account/change-password', requireAccount, (c) => {
	const redirect = requireElevation(c, 'change-password');
	if (redirect) return redirect;

	return c.html(ChangePasswordForm({ values: {}, errors: [] }));
});

app.post('/account/change-password', requireAccount, async (c) => {
	const redirect = requireElevation(c, 'change-password');
	if (redirect) return redirect;

	const account = <Account>c.get('account');
	const session = <SessionToken>c.get('session');
	const body = await c.req.parseBody();
	const password = simpleEscapeString(body.password);

	if (!password) {
		return c.html(ChangePasswordForm({ values: { password }, errors: [{ field: 'password', message: 'Please provide a new password' }] }));
	}

	const result = await AccountService.setPassword(account, password);
	if (!result.ok) {
		switch (result.error.type) {
			case 'invalid_password':
				return c.html(ChangePasswordForm({ values: { password }, errors: [{ field: 'password', message: 'New password must have at least 8 characters and should not be trivial' }] }));
			case 'trivial_password':
				return c.html(ChangePasswordForm({ values: { password }, errors: [{ field: 'password', message: 'The chosen password is too common, please choose a stronger password' }] }));
			default:
				return c.html(ErrorView({ message: 'Failed to update password. Please send a message to our customer support.' }));
		}
	}

	// Clear old session and privilege, terminate all other sessions
	clearPrivilegeElevation(c, session);
	clearSessionCookie(c);

	// Create new session and elevate privilege (user just proved identity)
	const newSession = createSessionToken(account.id, { userAgent: simpleEscapeString(c.req.header('User-Agent')) });
	initSessionCookie(c, newSession);
	elevatePrivilege(c, newSession);

	setSessionFlash(newSession, { type: 'success', message: 'Your password has been changed' });
	return c.redirect('/account');
});

// --- CHANGE EMAIL ---
app.get('/account/change-email', requireAccount, (c) => {
	const redirect = requireElevation(c, 'change-email');
	if (redirect) return redirect;

	return c.html(ChangeEmailForm({ values: {}, errors: [] }));
});

app.post('/account/change-email', requireAccount, async (c) => {
	const redirect = requireElevation(c, 'change-email');
	if (redirect) return redirect;

	const account = <Account>c.get('account');
	const session = <SessionToken>c.get('session');
	const body = await c.req.parseBody();
	const email = simpleEscapeEmail(body.email);

	if (!email) {
		return c.html(ChangeEmailForm({ values: { email }, errors: [{ field: 'email', message: 'Please provide a new email address' }] }));
	}
	if (!isValidEmail(email)) {
		return c.html(ChangeEmailForm({ values: { email }, errors: [{ field: 'email', message: 'Invalid email address' }] }));
	}

	const result = await AccountService.changeEmail(account.id, email);

	if (!result.ok) {
		if (result.error.type === 'email_in_use') {
			return c.html(ChangeEmailForm({ values: { email }, errors: [{ field: 'email', message: 'Email is already in use' }] }));
		}
		if (result.error.type === 'invalid_email') {
			return c.html(ChangeEmailForm({ values: { email }, errors: [{ field: 'email', message: 'Invalid email address' }] }));
		}
		return c.html(ErrorView({ message: 'Failed to change email address. Please send a message to our customer support.' }));
	}

	setSessionFlash(session, { type: 'success', message: 'Your email address has been changed' });
	return c.redirect('/account');
});

// --- DELETE ACCOUNT ---
app.get('/account/delete', requireAccount, (c) => {
	const redirect = requireElevation(c, 'delete');
	if (redirect) return redirect;

	return c.html(DeleteAccountForm({ values: {}, errors: [] }));
});

app.post('/account/delete', requireAccount, async (c) => {
	const redirect = requireElevation(c, 'delete');
	if (redirect) return redirect;

	const session = <SessionToken>c.get('session');
	const account = <Account>c.get('account');
	const body = await c.req.parseBody();
	const confirm = simpleEscapeString(body.confirm);

	if (confirm.toUpperCase() !== 'DELETE') {
		return c.html(DeleteAccountForm({ values: { confirm }, errors: [{ field: 'confirm', message: 'Please type DELETE to confirm.' }] }));
	}

	const tombstone = deleteAccountAndCreateTombstone(account);
	if (!tombstone) {
		audit('account_delete_failed', account.id, AuditLevel.ERROR, { message: 'No tombstone returned' });
	} else {
		audit('account_deleted', account.id, AuditLevel.OK);
	}

	clearPrivilegeElevation(c, session);
	clearSessionCookie(c);
	terminateAllSessionsForAccount(account.id);

	return c.html(SuccessView({ title: 'Account deleted', message: 'Your account has been deleted.' }));
});

export default app;
