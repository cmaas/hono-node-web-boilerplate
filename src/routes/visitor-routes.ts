import type { HttpBindings } from '@hono/node-server';
import { Hono } from 'hono';
import { html } from 'hono/html';
import type { Account } from '../domain/account.js';
import type { SessionToken } from '../domain/token.js';
import { sendEmail } from '../infrastructure/email.js';
import { AuditLevel, audit } from '../infrastructure/events.js';
import { clearSessionCookie, elevatePrivilege, initSessionCookie } from '../plugins/server-session.js';
import { getAccount, getAccountByEmail, updateAccount } from '../repositories/account-repository.js';
import { createPasswordResetToken, createSessionToken, deletePasswordResetToken, getLoginToken, getPasswordResetToken, getVerifyEmailToken, updateLastSessionActivity } from '../repositories/token-repository.js';
import * as AccountService from '../services/account-service.js';
import { isValidEmail, isValidToken } from '../utils/util.js';
import { EmailVerifyForm } from '../views/email-verification.js';
import { ErrorView, SuccessView } from '../views/generic.js';
import { LoginForm, LoginWithTokenForm } from '../views/login.js';
import { Main } from '../views/main.js';
import { NewPasswordForm, PasswordResetRequestForm, PasswordResetRequestSucess } from '../views/password-reset.js';
import { SignupForm } from '../views/signup.js';

type Bindings = HttpBindings & {
	/* ... */
};

const app = new Hono<{ Bindings: Bindings; Variables: { session: SessionToken; account: Account } }>();

app.get('/', (c) => {
	const account = <Account>c.get('account');
	const meta = { title: 'Home', description: 'Welcome to the home page' };
	if (account) {
		const session = <SessionToken>c.get('session');
		updateLastSessionActivity(session);
		return c.html(
			Main(
				html`<h1>Welcome back ${account.email}</h1>
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
	if (c.get('account')) {
		return c.redirect('/account');
	}
	return c.html(LoginForm({ values: {}, errors: [] }));
});

app.post('/login', async (c) => {
	if (c.get('account')) {
		return c.redirect('/account');
	}

	const body = await c.req.parseBody();
	const values = { email: (<string>body.email || '').trim() };
	const password = (<string>body.password || '').trim();

	const result = await AccountService.login(values.email, password);
	if (!result.ok) {
		switch (result.error.type) {
			case 'invalid_email':
				return c.html(LoginForm({ values, errors: [{ field: 'email', message: 'Please provide a valid email address' }] }));
			case 'account_not_found':
				return c.html(LoginForm({ values, errors: [{ field: 'email', message: 'There is no account with this email address' }] }));
			case 'invalid_password':
				return c.html(LoginForm({ values, errors: [{ field: 'password', message: 'Wrong password' }] }));
			default:
				return c.html(LoginForm({ values, errors: [{ field: 'email', message: 'Login failed, please try again.' }] }));
		}
	}

	const session = createSessionToken(result.value.account.id, { userAgent: c.req.header('User-Agent') || '' });
	initSessionCookie(c, session);
	elevatePrivilege(c, session);

	return c.redirect('/');
});

// --- LOGIN BY TOKEN ---
app.get('/login/t/:token', async (c) => {
	if (c.get('account')) {
		return c.redirect('/account');
	}
	const token = c.req.param('token');
	return c.html(LoginWithTokenForm({ values: { token }, errors: [] }));
});

app.post('/login/t', async (c) => {
	if (c.get('account')) {
		return c.redirect('/account');
	}

	const body = await c.req.parseBody();
	const values = { token: (<string>body.token || '').trim() };

	if (!isValidToken(values.token)) {
		return c.html(LoginWithTokenForm({ values, errors: [{ field: 'token', message: 'Please provide a valid token' }] }));
	}

	const token = getLoginToken(values.token);
	if (!token || token.expires < Date.now()) {
		return c.html(ErrorView({ message: 'Login link not found or expired', showLoginButton: true }), 401);
	}

	const account = getAccount(token.accountId);
	if (!account) {
		return c.html(LoginForm({ values, errors: [{ field: 'email', message: 'No account found for this token' }] }));
	}

	// login token can also verify the email address of the account
	if (account.emailVerified <= 0 && token.payload?.verifyEmail && token.payload.verifyEmail === account.email) {
		account.emailVerified = Date.now();
		updateAccount(account);
	}

	const session = createSessionToken(account.id, { userAgent: c.req.header('User-Agent') || '' });
	initSessionCookie(c, session);
	elevatePrivilege(c, session); // depending on the use case, you might want to NOT elevate privilges when using a login token

	return c.redirect('/');
});

// --- SIGNUP FLOW ---
app.get('/signup', (c) => {
	if (c.get('account')) {
		return c.redirect('/account');
	}
	return c.html(SignupForm({ values: {}, errors: [] }));
});

app.post('/signup', async (c) => {
	if (c.get('account')) {
		return c.redirect('/account');
	}

	const body = await c.req.parseBody();
	const values = { email: (<string>body.email || '').trim(), password: (<string>body.password || '').trim() };

	const result = await AccountService.signup(values.email, values.password);
	if (!result.ok) {
		switch (result.error.type) {
			case 'invalid_email':
				return c.html(SignupForm({ values, errors: [{ field: 'email', message: 'Please provide a valid email address' }] }));
			case 'email_exists':
				return c.html(SignupForm({ values, errors: [{ field: 'email', message: 'Email address is already in use' }] }));
			case 'invalid_password':
				return c.html(SignupForm({ values, errors: [{ field: 'password', message: 'Password must have at least 8 characters and should not be trivial' }] }));
			case 'trivial_password':
				return c.html(SignupForm({ values, errors: [{ field: 'password', message: 'The chosen password is too common, please choose a stronger password' }] }));
			case 'error_creating_account':
				return c.html(SignupForm({ values, errors: [{ field: 'email', message: 'Failed to create account, please try again.' }] }));
			default:
				return c.html(SignupForm({ values, errors: [{ field: 'email', message: 'Failed to create account, please try again.' }] }));
		}
	}

	const session = createSessionToken(result.value.account.id, { userAgent: c.req.header('User-Agent') || '' });
	initSessionCookie(c, session);
	elevatePrivilege(c, session);

	return c.redirect('/');
});

/**
 * Password reset step 1: User requests a password reset link by providing their email address.
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
 */
app.post('/reset-password', async (c) => {
	const body = await c.req.parseBody();
	const values = { email: (<string>body.email || '').trim() };

	if (!isValidEmail(values.email)) {
		return c.html(PasswordResetRequestForm({ values, errors: [{ field: 'email', message: 'Please provide a valid email address' }] }));
	}
	const account = <Account>getAccountByEmail(values.email as string);
	if (!account) {
		return c.html(PasswordResetRequestForm({ values, errors: [{ field: 'email', message: 'There is no account with this email address' }] }));
	}

	const token = createPasswordResetToken(account.id, { verifyEmail: account.email, userAgent: c.req.header('User-Agent') || '' });
	sendEmail(account.email, 'Password reset', `Click the link to reset your password: http://localhost:3000/set-password?token=${token.id}`);

	audit('account_reset_password_requested', account.id, AuditLevel.OK, { tokenId: token.id });

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

	const account = getAccount(token.accountId);
	if (!account) {
		return c.html(ErrorView({ message: 'Account not found.' }));
	}

	const result = await AccountService.setPassword(account, values.password);
	if (!result.ok) {
		switch (result.error.type) {
			case 'invalid_password':
				return c.html(NewPasswordForm({ values, errors: [{ field: 'password', message: 'Password must have at least 8 characters' }] }));
			case 'trivial_password':
				return c.html(NewPasswordForm({ values, errors: [{ field: 'password', message: 'The chosen password is too common, please choose a stronger password' }] }));
			default:
				return c.html(ErrorView({ message: 'Failed to update password. Please send a message to our customer support.' }));
		}
	}

	deletePasswordResetToken(values.id);
	clearSessionCookie(c);

	// log the user in directly after password reset
	const session = createSessionToken(result.value.account.id, { userAgent: c.req.header('User-Agent') || '' });
	initSessionCookie(c, session);
	elevatePrivilege(c, session);

	// verify email address if it is not verified yet
	if (result.value.account.emailVerified <= 0 && token.payload?.verifyEmail && token.payload.verifyEmail === result.value.account.email) {
		result.value.account.emailVerified = Date.now();
		updateAccount(result.value.account);
		audit('account_email_verified', result.value.account.id, AuditLevel.OK);
	}

	return c.html(SuccessView({ message: 'Your password has been changed', showAccountButton: true }));
});

// Email verification step 1 is in account sub app, because it requires a logged-in user

/**
 * Email verification step 2: User clicks link in email (GET request).
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
			audit('system_error', account.id, AuditLevel.ERROR, { message: 'Failed to set verified status' });
		} else {
			audit('account_email_verified', account.id, AuditLevel.OK);
		}
	}

	const session = c.get('session');
	const showAccountButton = !!session;

	return c.html(SuccessView({ message: `Email verified, thank you! You can now close this window.`, title: 'Email verified', showAccountButton, showLoginButton: !showAccountButton }));
});

export default app;
