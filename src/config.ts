import { loadEnvFile } from 'node:process';

loadEnvFile('.env');

if (!process.env.CRON_API_TOKEN) {
	console.error('CRON_API_TOKEN is not set in environment variables. Exiting.');
	process.exit(1);
}

export const GlobalConfig = {
	CRON_API_TOKEN: process.env.CRON_API_TOKEN,
}
