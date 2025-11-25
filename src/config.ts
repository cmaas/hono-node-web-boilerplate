import { loadEnvFile } from 'node:process';

loadEnvFile('.env');

if (!process.env.CRON_API_TOKEN) {
	console.error('CRON_API_TOKEN is not set in environment variables. Exiting.');
	process.exit(1);
}

export const GlobalConfig = {
	CRON_API_TOKEN: process.env.CRON_API_TOKEN,
	TIMEOUT_SESSION: 7 * 1000 * 60 * 60 * 24, // 7 days
	TIMEOUT_VERIFY_EMAIL: 30 * 1000 * 60 * 60 * 24, // 30 days
	TIMEOUT_PASSWORD_RESET: 2 * 1000 * 60 * 60, // 2 hours
	TIMEOUT_INACTIVITY_LAST_VISIT_REFRESH: 1 * 1000 * 60 * 60,
}
