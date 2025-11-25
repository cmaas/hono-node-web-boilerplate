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

import { EventEmitter } from 'node:events';
import { type HttpBindings, serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { html } from 'hono/html';
import { logger } from 'hono/logger';
import accountApp from './account.js';
import adminApp from './admin.js';
import cronApp from './cron.js';
import { EMAIL_VERIFY, sendEmail } from './email.js';
import { type Account, createAccount, getAccount, getAccountByEmail, terminateAllSessionsForAccount, updateAccount, updateAccountPassword } from './models/account.js';
import { createPasswordResetToken, createSessionToken, createVerifyEmailToken, deletePasswordResetToken, getPasswordResetToken, getVerifyEmailToken, type SessionToken, updateLastSessionActivity } from './models/token.js';
import { clearSessionCookie, initSessionCookie, sessionMiddleware } from './plugins/server-session.js';
import { isSamePassword, isValidEmail, isValidToken, satisfiesPasswordPolicy } from './util.js';
import { EmailVerifyForm } from './views/email-verification.js';
import { ErrorView, SuccessView } from './views/generic.js';
import { LoginForm } from './views/login.js';
import { Main } from './views/main.js';
import { NewPasswordForm, PasswordResetRequestForm, PasswordResetRequestSucess } from './views/password-reset.js';
import { SignupForm } from './views/signup.js';

type Bindings = HttpBindings & {
	/* ... */
};

// --- SETUP ---
const app = new Hono<{ Bindings: Bindings; Variables: { session: SessionToken; account: Account } }>();
app.use(logger());
app.use('*', sessionMiddleware());
app.use('/public/*', serveStatic({ root: './' }));

// --- EVENTS ---
export const EVENTS = {
	ACCOUNT_CREATED: 'account:created',
	ACCOUNT_VERIFIED_EMAIL: 'account:verified_email',
	ACCOUNT_CHANGED_EMAIL: 'account:changed_email',
	ACCOUNT_PASSWORD_RESET_INIT: 'account:password_reset_init',
	ACCOUNT_PASSWORD_UPDATED: 'account:updated_password',
	ACCOUNT_PASSWORD_UPDATE_FAILED: 'account:failed_password_update',
	ACCOUNT_UPDATED: 'account:updated',
	ACCOUNT_UPDATE_FAILED: 'account:update_failed',
	LOGIN_INVALID_PASSWORD: 'login:invalid_password',
};

export const eventBus = new EventEmitter();
const logEvent = (name: string) => (payload: unknown) => console.log(`[eventBus] ${name}`, payload);

// simple event listeners; in your app, you might want to send emails, notify external systems etc.
for (const eventName of Object.values(EVENTS)) {
	eventBus.on(eventName, logEvent(eventName));
}

// --- ROUTES ---
app.route('/account', accountApp);
app.route('/admin', adminApp);
app.route('/cron', cronApp);

app.get('/', (c) => {
	const account = <Account>c.get('account');
	const meta = { title: 'Home', description: 'Welcome to the home page' };
	if (account) {
		const session = <SessionToken>c.get('session');
		updateLastSessionActivity(session);
		const formatDate = (v: unknown) => (v ? new Date(v as any).toLocaleString() : 'n/a');
		const prev = formatDate(session.payload?.previousVisit);
		const last = formatDate(session.payload?.lastActivity);
		console.log('SESSION INFO: prevVisit / lastActivity', prev, last);
		return c.html(
			Main(
				html`<h1>Welcome back ${account.email}</h1>
					<p>Your previous visit: ${prev}</p>
					<p><a href="/account/special">Special page</a> (requires verified email)</p>`,
				meta,
				{ account },
			),
		);
	}
	return c.html(Main(html`<h1>You are not logged in yet</h1>`, meta));
});

// --- LOGIN FLOW ---
app.get('/login', (c) => {
	// do not allow login if already logged in
	if (c.get('account')) {
		return c.redirect('/account');
	}

	return c.html(LoginForm({ values: {}, errors: [] }));
});

app.post('/login', async (c) => {
	// do not allow login if already logged in
	if (c.get('account')) {
		return c.redirect('/account');
	}

	const body = await c.req.parseBody();
	const values = { email: (<string>body.email || '').trim() };

	if (!isValidEmail(values.email)) {
		return c.html(LoginForm({ values, errors: [{ field: 'email', message: 'Please provide a valid email address' }] }));
	}

	if (!body.password || typeof body.password !== 'string' || body.password.length < 6) {
		return c.html(LoginForm({ values, errors: [{ field: 'password', message: 'Please provide your password' }] }));
	}

	const account = getAccountByEmail(values.email as string);
	if (!account) {
		return c.html(LoginForm({ values, errors: [{ field: 'email', message: 'There is no account with this email address' }] }));
	}

	if (!(await isSamePassword(account.password, body.password as string))) {
		eventBus.emit(EVENTS.LOGIN_INVALID_PASSWORD, { account });
		return c.html(LoginForm({ values, errors: [{ field: 'password', message: 'Wrong password' }] }));
	}

	const session = createSessionToken(account.id, { userAgent: c.req.header('User-Agent') || '' }); // server
	initSessionCookie(c, session); // client

	return c.redirect('/');
});

// --- SIGNUP FLOW ---
app.get('/signup', (c) => {
	// do not allow signup if already logged in
	if (c.get('account')) {
		return c.redirect('/account');
	}
	return c.html(SignupForm({ values: {}, errors: [] }));
});

app.post('/signup', async (c) => {
	// do not allow signup if already logged in
	if (c.get('account')) {
		return c.redirect('/account');
	}

	const body = await c.req.parseBody();
	const values = { email: (<string>body.email || '').trim(), password: (<string>body.password || '').trim() };

	if (!isValidEmail(values.email)) {
		return c.html(SignupForm({ values, errors: [{ field: 'email', message: 'Please provide a valid email address' }] }));
	}
	if (getAccountByEmail(values.email as string)) {
		return c.html(SignupForm({ values, errors: [{ field: 'email', message: 'Email address is already in use' }] }));
	}
	// in this case, using a password is optional. if none is provided, a secure random password is generated,
	// but never given to the user. this reduces signup friction and makes mostly sense with long-lived sessions.
	// if the user wants to set their password, they must use the password reset flow.
	if (values.password && values.password.length > 0 && !satisfiesPasswordPolicy(values.password)) {
		return c.html(SignupForm({ values, errors: [{ field: 'password', message: 'Password must have at least 8 characters and should not be trivial' }] }));
	}

	const account = await createAccount(values.email);
	eventBus.emit(EVENTS.ACCOUNT_CREATED, { account });

	// create new session
	const session = createSessionToken(account.id, { userAgent: c.req.header('User-Agent') || '' }); // server
	initSessionCookie(c, session); // client

	// create email verification token and send email
	const token = createVerifyEmailToken(account.id, account.email);
	sendEmail(account.email, EMAIL_VERIFY.subject, EMAIL_VERIFY.body(token.id));

	return c.redirect('/');
});

/**
 * Password reset step 1: User requests a password reset link by providing their email address.
 * - User can be logged in or not. Maybe the user forgot their password, but wants to log in to another device.
 */
app.get('/reset-password', (c) => {
	const account = <Account>c.get('account');
	let email = '';
	if (account) {
		email = account.email;
	}
	return c.html(PasswordResetRequestForm({ values: { email }, errors: [] }));
});

/**
 * Password reset step 2: Create reset token, send an email with a reset link.
 * - Rate limit in web server config!
 */
app.post('/reset-password', async (c) => {
	const body = await c.req.parseBody();
	const values = { email: (<string>body.email || '').trim() };

	if (!isValidEmail(values.email)) {
		return c.html(PasswordResetRequestForm({ values, errors: [{ field: 'email', message: 'Please provide a valid email address' }] }));
	}
	// beware: this can be used to enumerate valid email addresses, but the UX is better this way; rate limit via web server / proxy
	const account = <Account>getAccountByEmail(values.email as string);
	if (!account) {
		return c.html(PasswordResetRequestForm({ values, errors: [{ field: 'email', message: 'There is no account with this email address' }] }));
	}

	const token = createPasswordResetToken(account.id, { userAgent: c.req.header('User-Agent') || '' });
	sendEmail(account.email, 'Password reset', `Click the link to reset your password: http://localhost:3000/set-password?token=${token.id}`);

	eventBus.emit(EVENTS.ACCOUNT_PASSWORD_RESET_INIT, { account, token });

	return c.html(PasswordResetRequestSucess());
});

/**
 * Password reset step 3: User clicks link in email (GET request) and is taken to a form to enter a new password.
 */
app.get('/set-password', (c) => {
	const id = c.req.query('token');
	if (!id || !isValidToken(id)) {
		return c.html(ErrorView({ message: 'Invalid password reset token' }));
	}

	const token = getPasswordResetToken(id);
	if (!token || token.expires < Date.now()) {
		return c.html(ErrorView({ message: 'Password reset token expired or not found' }));
	}

	return c.html(NewPasswordForm({ values: { token: id }, errors: [] }));
});

/**
 * Password reset step 4: Validate token, set new password, invalidate token, invalidate all sessions of this user.
 * - Rate limit in web server config!
 */
app.post('/set-password', async (c) => {
	const body = await c.req.parseBody();
	const values = { id: <string>body.token || '', password: (<string>body.password || '').trim() };
	if (!isValidToken(values.id)) {
		return c.html(ErrorView({ message: 'Invalid password reset token' }));
	}

	const token = getPasswordResetToken(values.id);
	if (!token || token.expires < Date.now()) {
		return c.html(ErrorView({ message: 'Invalid password reset token' }));
	}
	if (!satisfiesPasswordPolicy(values.password)) {
		return c.html(NewPasswordForm({ values, errors: [{ field: 'password', message: 'Password must have at least 8 characters' }] }));
	}

	const account = getAccount(token.accountId);
	if (!account) {
		return c.html(ErrorView({ message: 'Account not found.' }));
	}
	const result = await updateAccountPassword(account.id, values.password);
	if (!result) {
		// todo: this should trigger some kind of notification to admins, because then we couldn't write to the db
		eventBus.emit(EVENTS.ACCOUNT_PASSWORD_UPDATE_FAILED, { account, token });
		return c.html(ErrorView({ message: 'Failed to update password. Please send a message to our customer support.' }));
	} else {
		eventBus.emit(EVENTS.ACCOUNT_PASSWORD_UPDATED, { account });
	}

	deletePasswordResetToken(values.id);
	clearSessionCookie(c);
	terminateAllSessionsForAccount(account.id);

	// opinionated: log the user in directly after password reset by creating a new session,
	// because they just proved they own the email address by clicking the link in their email
	const session = createSessionToken(account.id, { userAgent: c.req.header('User-Agent') || '' }); // server
	initSessionCookie(c, session); // client

	// opinionated: verify email address if it is not verified yet, because the user just clicked
	// a link in their email, so they must own the email address
	if (account.emailVerified <= 0) {
		account.emailVerified = Date.now();
		const result = updateAccount(account);
		if (!result) {
			eventBus.emit(EVENTS.ACCOUNT_UPDATE_FAILED, { account, error: 'Failed to set verified status after password change' });
		} else {
			eventBus.emit(EVENTS.ACCOUNT_VERIFIED_EMAIL, { account });
		}
	}

	return c.html(SuccessView({ message: 'Your password has been changed' }));
});

// Email verification step 1 is in account sub app, because it requires a logged-in user

/**
 * Email verification step 2: User clicks link in email (GET request).
 * - This route shows a form that auto-submits (via minimal client-side JS) to turn the request into a POST for security reasons.
 * - We do not validate the token here, just check if it looks valid.
 */
app.get('/verify-email', (c) => {
	const id = c.req.query('token');
	if (!isValidToken(id)) {
		return c.html(ErrorView({ message: 'Invalid email verification token' }));
	}
	return c.html(EmailVerifyForm({ values: { token: id }, errors: [] }));
});

/**
 * Email verification step 3: Verify the token and mark the email as verified.
 * - Email can be verified no matter if the user is logged in or not.
 * - We do not invalidate the token after use, because it can be confusing for the user if they click the link again.
 * - But also, we do not refresh the timestamp after the first validation.
 * - Verifying an email address does NOT log in the user automatically, because the verification link has a way longer expiration time.
 * - Rate limit in web server config!
 */
app.post('/verify-email', async (c) => {
	const body = await c.req.parseBody();
	const id = <string>body.token;
	if (!isValidToken(id)) {
		return c.html(ErrorView({ message: 'Invalid email verification token' }));
	}

	const token = getVerifyEmailToken(id);
	if (!token || token.expires < Date.now()) {
		return c.html(ErrorView({ message: 'Email verification token expired or not found. Please request a new verification email.' }));
	}

	const account = getAccount(token.accountId);
	if (!account) {
		return c.html(ErrorView({ message: 'Account not found' }));
	}

	// verify email if not already verified
	if (account.emailVerified <= 0) {
		account.emailVerified = Date.now();
		const result = updateAccount(account);
		if (!result) {
			eventBus.emit(EVENTS.ACCOUNT_UPDATE_FAILED, { account, error: 'Failed to set verified status' });
		} else {
			eventBus.emit(EVENTS.ACCOUNT_VERIFIED_EMAIL, { account });
		}
	}

	return c.html(SuccessView({ message: `Email verified, thank you! You can now close this window.`, title: 'Email verified' }));
});

// Export the app for testing
export { app };

// Only start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
	const port = 3000;
	console.log(`Server started: ${new Date().toLocaleString()}, running on http://localhost:${port}`);

	serve({
		fetch: app.fetch,
		port,
	});
}
