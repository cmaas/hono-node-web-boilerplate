import { loadEnvFile } from 'node:process';

loadEnvFile('.env');

/**
 * These config items must be present in .env, otherwise the app won't start.
 * Other config items are optional, see below in GlobalConfig.
 */
// biome-ignore format: cleaner
const requiredEnvVars = [
	'SERVER_PORT',
	'BASE_URL',
	'CRON_API_KEY',
	'SECURE_COOKIE',
	'DB_PATH',
	'SMTP_HOST',
	'SMTP_PORT',
] as const;

const missing = requiredEnvVars.filter((key) => !process.env[key]);
if (missing.length > 0) {
	console.error(`Missing required environment variables: ${missing.join(', ')}`);
	process.exit(1);
}

const env = Object.fromEntries(requiredEnvVars.map((key) => [key, process.env[key]])) as Record<(typeof requiredEnvVars)[number], string>;

export const MINUTES = 60 * 1000;
export const HOURS = 60 * MINUTES;
export const DAYS = 24 * HOURS;

export const GlobalConfig = {
	NODE_ENV: process.env.NODE_ENV || 'development',

	...env,

	SERVER_PORT: Number.parseInt(env.SERVER_PORT, 10),
	SECURE_COOKIE: env.SECURE_COOKIE === 'true',

	TEST_DB_PATH: process.env.TEST_DB_PATH || ':memory:',
	TRIVIAL_PASSWORDS: './data/trivial-passwords.txt',

	SMTP_PORT: Number.parseInt(env.SMTP_PORT, 10),
	SMTP_SECURE_CONNECTION: process.env.SMTP_SECURE_CONNECTION === 'yes',
	SMTP_USER: process.env.SMTP_USER,
	SMTP_PASS: process.env.SMTP_PASS,
	SMTP_IGNORE_CERT: process.env.SMTP_IGNORE_CERT === 'yes',

	/**
	 * Duration after which to refresh last visit timestamp in session on activity
	 */
	LAST_VISIT_REFRESH_AFTER_INACTIVITY: 1 * HOURS,

	/**
	 * Various token timeouts
	 */
	TIMEOUT_SESSION: 30 * DAYS,
	TIMEOUT_VERIFY_EMAIL: 60 * DAYS,
	TIMEOUT_PASSWORD_RESET: 15 * MINUTES,
	TIMEOUT_LOGIN_TOKEN: 15 * MINUTES,
	TIMEOUT_PRIVILEGE_ELEVATION: 10 * MINUTES,
};
