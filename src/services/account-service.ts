import type { Account } from '../domain/account.js';
import { type AsyncResult, Err, Ok } from '../domain/result.js';
import { EMAIL_VERIFY, sendEmail } from '../infrastructure/email.js';
import { AuditLevel, audit } from '../infrastructure/events.js';
import { createAccount, getAccount, getAccountByEmail, terminateAllSessionsForAccount, updateAccount, updateAccountPassword } from '../repositories/account-repository.js';
import { createVerifyEmailToken } from '../repositories/token-repository.js';
import { isTrivialPassword } from '../repositories/trivial-passwords-repository.js';
import { isSamePassword, isValidEmail, satisfiesPasswordPolicy } from '../utils/util.js';

// --- Error Types ---

// biome-ignore format: cleaner
export type SignupError =
	{ type: 'invalid_email' }
	| { type: 'invalid_password' }
	| { type: 'trivial_password' }
	| { type: 'email_exists' }
	| { type: 'error_creating_account'; message: string };

export async function signup(email: string, password?: string): AsyncResult<{ account: Account }, SignupError> {
	if (!isValidEmail(email)) {
		return Err({ type: 'invalid_email' });
	}
	if (getAccountByEmail(email)) {
		return Err({ type: 'email_exists' });
	}

	// Validate password if provided
	if (password !== undefined && password.trim().length > 0) {
		if (!satisfiesPasswordPolicy(password)) {
			return Err({ type: 'invalid_password' });
		}
		if (isTrivialPassword(password)) {
			return Err({ type: 'trivial_password' });
		}
	}

	let account: Account | null = null;
	try {
		account = await createAccount(email, password);
	} catch (err) {
		audit('account_create_failed', null, AuditLevel.ERROR, { message: (err as Error).message });
		return Err({ type: 'error_creating_account', message: 'Failed to create account. Please try again or contact support.' });
	}

	audit('account_created', account.id, AuditLevel.OK);

	const verifyEmailToken = createVerifyEmailToken(account.id, account.email);
	sendEmail(account.email, EMAIL_VERIFY.subject, EMAIL_VERIFY.body(verifyEmailToken.id));

	return Ok({ account });
}

// biome-ignore format: cleaner
export type LoginError =
	{ type: 'invalid_email' }
	| { type: 'invalid_password' }
	| { type: 'account_not_found' };

export async function login(email: string, password: string): AsyncResult<{ account: Account }, LoginError> {
	if (!isValidEmail(email)) {
		return Err({ type: 'invalid_email' });
	}

	const account = getAccountByEmail(email);
	if (!account) {
		return Err({ type: 'account_not_found' });
	}

	if (!(await isSamePassword(account.password, password))) {
		audit('account_invalid_password', account.id, AuditLevel.WARN);
		return Err({ type: 'invalid_password' });
	}

	return Ok({ account });
}

// biome-ignore format: cleaner
export type SetPasswordError =
	{ type: 'invalid_password' }
	| { type: 'trivial_password' };

export async function setPassword(account: Account, newPassword: string): AsyncResult<{ account: Account }, SetPasswordError> {
	if (!satisfiesPasswordPolicy(newPassword)) {
		return Err({ type: 'invalid_password' });
	}
	if (isTrivialPassword(newPassword)) {
		return Err({ type: 'trivial_password' });
	}

	await updateAccountPassword(account.id, newPassword);
	terminateAllSessionsForAccount(account.id);
	audit('account_password_changed', account.id, AuditLevel.OK);

	return Ok({ account });
}

// biome-ignore format: cleaner
export type ChangeEmailError =
	{ type: 'invalid_email' }
	| { type: 'email_in_use' }
	| { type: 'account_not_found' }
	| { type: 'update_failed' };

export async function changeEmail(accountId: string, newEmail: string): AsyncResult<void, ChangeEmailError> {
	const email = newEmail.trim();

	if (!isValidEmail(email)) {
		return Err({ type: 'invalid_email' });
	}

	const account = getAccount(accountId);
	if (!account) {
		return Err({ type: 'account_not_found' });
	}

	const existingAccount = getAccountByEmail(email);
	if (existingAccount) {
		return Err({ type: 'email_in_use' });
	}

	account.email = email;
	account.emailVerified = 0;

	const result = updateAccount(account);
	if (!result) {
		return Err({ type: 'update_failed' });
	}

	const token = createVerifyEmailToken(account.id, account.email);
	sendEmail(account.email, EMAIL_VERIFY.subject, EMAIL_VERIFY.body(token.id));

	audit('account_email_changed', account.id, AuditLevel.OK);

	return Ok(undefined);
}

export async function requestVerificationEmail(accountId: string): AsyncResult<void, ChangeEmailError> {
	const account = getAccount(accountId);
	if (!account) {
		return Err({ type: 'account_not_found' });
	}

	const token = createVerifyEmailToken(account.id, account.email);
	sendEmail(account.email, EMAIL_VERIFY.subject, EMAIL_VERIFY.body(token.id));

	return Ok(undefined);
}
