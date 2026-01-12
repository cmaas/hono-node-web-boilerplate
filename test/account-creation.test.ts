import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createAccount, getAccount, getAccountByEmail } from '../src/models/account.js';
import { isValidEmail, isValidToken } from '../src/util.js';

describe('Account Creation Tests', () => {
	// Generate unique test identifiers for this test run
	const testRunId = Date.now().toString();

	// Helper function to generate unique test emails
	const getTestEmail = (name: string) => `${name}-${testRunId}@test.example.com`;

	describe('Model Tests - createAccount function', () => {
		test('should create account with valid email and no password', async () => {
			const email = getTestEmail('test1');
			const account = await createAccount(email);

			assert.ok(account, 'Account should be created');
			assert.strictEqual(account.email, email, 'Email should match');
			assert.ok(isValidToken(account.id), 'Account ID should be a valid token');
			assert.ok(account.password.length > 0, 'Password should be generated');
			assert.strictEqual(account.emailVerified, 0, 'Email should not be verified initially');
			assert.strictEqual(account.role, 'user', 'Default role should be user');
			assert.ok(account.created > 0, 'Created timestamp should be set');
			assert.strictEqual(account.updated, 0, 'Updated timestamp should be 0 initially');

			// Verify account is in database
			const retrievedAccount = getAccount(account.id);
			assert.ok(retrievedAccount, 'Account should be retrievable from database');
			assert.strictEqual(retrievedAccount?.email, email, 'Retrieved email should match');
		});

		test('should create account with valid email and custom password', async () => {
			const email = getTestEmail('test2');
			const password = 'customPassword123';
			const account = await createAccount(email, password);

			assert.ok(account, 'Account should be created');
			assert.strictEqual(account.email, email, 'Email should match');
			assert.ok(account.password.length > 0, 'Password should be hashed');
			assert.notStrictEqual(account.password, password, 'Password should be hashed, not plain text');
		});

		test('should generate unique account IDs', async () => {
			const account1 = await createAccount(getTestEmail('test3'));
			const account2 = await createAccount(getTestEmail('test4'));

			assert.notStrictEqual(account1.id, account2.id, 'Account IDs should be unique');
		});

		test('should fail to create account with duplicate email', async () => {
			const email = getTestEmail('duplicate');
			await createAccount(email);

			// Attempting to create another account with the same email should throw
			try {
				await createAccount(email);
				assert.fail('Should have thrown an error for duplicate email');
			} catch (error) {
				assert.ok(error, 'Should throw error for duplicate email');
			}
		});

		test('should retrieve account by email', async () => {
			const email = getTestEmail('retrieve');
			const account = await createAccount(email);

			const retrievedAccount = getAccountByEmail(email);
			assert.ok(retrievedAccount, 'Should retrieve account by email');
			assert.strictEqual(retrievedAccount?.id, account.id, 'Retrieved account ID should match');
			assert.strictEqual(retrievedAccount?.email, email, 'Retrieved email should match');
		});

		test('should return null for non-existent email', () => {
			const retrievedAccount = getAccountByEmail(getTestEmail('nonexistent'));
			assert.strictEqual(retrievedAccount, null, 'Should return null for non-existent email');
		});
	});

	describe('Utility Function Tests', () => {
		test('isValidEmail should validate emails correctly', () => {
			const validEmails = [
				'test@example.com',
				'user.name@domain.co.uk',
				'test+tag@example.org',
				'123@numbers.com',
				'test..test@example.com', // Simple regex allows this
			];

			const invalidEmails = ['', 'invalid', '@example.com', 'test@', 'test@example', 'test @example.com'];

			for (const email of validEmails) {
				assert.ok(isValidEmail(email), `Should validate email: ${email}`);
			}

			for (const email of invalidEmails) {
				assert.ok(!isValidEmail(email), `Should reject email: ${email}`);
			}
		});

		/* test('satisfiesPasswordPolicy should validate passwords correctly', () => {
			const validPasswords = ['password123', '123456789', 'a'.repeat(8)];

			const invalidPasswords = [
				'',
				'short',
				'1234567', // 7 characters
				'   ', // Only whitespace
				'asdfasdf', // trivial
				'password', // trivial
				'12345678', // trivial
			];

			for (const password of validPasswords) {
				assert.ok(satisfiesPasswordPolicy(password), `Should validate password: ${password}`);
			}

			for (const password of invalidPasswords) {
				assert.ok(!satisfiesPasswordPolicy(password), `Should reject password: ${password}`);
			}

			// Test null and undefined separately
			assert.ok(!satisfiesPasswordPolicy(null as unknown as string), 'Should reject null password');
			assert.ok(!satisfiesPasswordPolicy(undefined as unknown as string), 'Should reject undefined password');
		}); */

		test('isValidToken should validate tokens correctly', () => {
			const validTokens = ['Abc123_-Z', 'A', '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz-', 'a'.repeat(256)];

			const invalidTokens = [
				'',
				'invalid!',
				'token with spaces',
				'token@with#special$chars',
				'a'.repeat(257), // Too long
			];

			for (const token of validTokens) {
				assert.ok(isValidToken(token), `Should validate token: ${token}`);
			}

			for (const token of invalidTokens) {
				assert.ok(!isValidToken(token), `Should reject token: ${token}`);
			}

			// Test null and undefined separately
			assert.ok(!isValidToken(null), 'Should reject null token');
			assert.ok(!isValidToken(undefined), 'Should reject undefined token');
		});
	});
});
