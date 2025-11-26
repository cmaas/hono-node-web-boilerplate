import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { app } from '../src/index.js';
import { createAccount, getAccountByEmail } from '../src/models/account.js';

describe('Signup Integration Tests', () => {
	const testRunId = Date.now().toString();
	const getTestEmail = (name: string) => `${name}-${testRunId}@test.example.com`;

	test('POST /signup should successfully create account with valid email', async () => {
		const email = getTestEmail('integration1');

		await app.request('/signup', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: new URLSearchParams({
				email: email,
				password: '',
			}),
		});

		// Verify account was created in the app's database (which is now our test db)
		const account = getAccountByEmail(email);
		assert.ok(account, 'Account should be created in database');
		assert.strictEqual(account.email, email, 'Email should match');
	});

	test('POST /signup should successfully create account with valid email and password', async () => {
		const email = getTestEmail('integration2');
		const password = 'validPassword123';

		await app.request('/signup', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: new URLSearchParams({
				email: email,
				password: password,
			}),
		});

		// Verify account was created in database
		const account = getAccountByEmail(email);
		assert.ok(account, 'Account should be created in database');
		assert.strictEqual(account.email, email, 'Email should match');
	});

	test('POST /signup should reject invalid email', async () => {
		const res = await app.request('/signup', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: new URLSearchParams({
				email: 'invalid-email',
				password: '',
			}),
		});

		assert.strictEqual(res.status, 200, 'Should return form with error');
		const text = await res.text();
		assert.ok(text.includes('valid email address'), 'Should show email validation error');
	});

	test('POST /signup should reject duplicate email', async () => {
		const email = getTestEmail('duplicate');

		// Create account first - this will use the same test database as the app
		await createAccount(email);

		// Try to signup with same email
		const res = await app.request('/signup', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: new URLSearchParams({
				email: email,
				password: '',
			}),
		});

		assert.strictEqual(res.status, 200, 'Should return form with error');
		const text = await res.text();
		assert.ok(text.includes('already in use'), 'Should show duplicate email error');
	});

	test('POST /signup should reject invalid password', async () => {
		const email = getTestEmail('password');

		const res = await app.request('/signup', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: new URLSearchParams({
				email: email,
				password: 'short', // Less than 8 characters
			}),
		});

		assert.strictEqual(res.status, 200, 'Should return form with error');
		const text = await res.text();
		assert.ok(text.includes('at least 8 characters'), 'Should show password validation error');

		// Verify account was NOT created
		const account = getAccountByEmail(email);
		assert.strictEqual(account, null, 'Account should not be created with invalid password');
	});
});
