import { loadEnvFile } from 'node:process';

loadEnvFile('.env');

if (!process.env.CRON_API_TOKEN) {
	console.error('CRON_API_TOKEN is not set in environment variables. Exiting.');
	process.exit(1);
}

export const MINUTES = 60 * 1000;
export const HOURS = 60 * MINUTES;
export const DAYS = 24 * HOURS;

export const GlobalConfig = {
	CRON_API_TOKEN: process.env.CRON_API_TOKEN,
	TIMEOUT_SESSION: 7 * DAYS,
	TIMEOUT_VERIFY_EMAIL: 30 * DAYS,
	TIMEOUT_PASSWORD_RESET: 2 * HOURS,
	TIMEOUT_LOGIN_TOKEN: 10 * MINUTES,
	TIMEOUT_INACTIVITY_LAST_VISIT_REFRESH: 1 * HOURS,
	TIMEOUT_PRIVILEGE_ELEVATION: 10 * MINUTES, // 10 minutes
};
