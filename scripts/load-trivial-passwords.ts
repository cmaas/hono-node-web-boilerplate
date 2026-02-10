#!/usr/bin/env tsx
/**
 * Script to load trivial passwords from a text file into the SQLite database
 * Usage: tsx scripts/load-trivial-passwords.ts <path-to-passwords-file>
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { db } from '../src/infrastructure/db.js';

const args = process.argv.slice(2);

if (args.length === 0) {
	console.error('Usage: tsx scripts/load-trivial-passwords.ts <path-to-passwords-file>');
	process.exit(1);
}

const filePath = resolve(args[0]);
console.log(`Loading passwords from: ${filePath}`);

try {
	// Read the file
	const content = readFileSync(filePath, 'utf8');
	const passwords = content.split('\n').filter((line) => line.trim().length > 0);

	console.log(`Found ${passwords.length} passwords in file`);

	// Clear existing passwords
	console.log('Clearing existing passwords...');
	db.prepare('DELETE FROM trivial_passwords').run();

	// Prepare insert statement
	const insertStmt = db.prepare('INSERT OR IGNORE INTO trivial_passwords (password) VALUES (?)');

	// Use a transaction for better performance
	const insertMany = db.transaction((passwords: string[]) => {
		for (const password of passwords) {
			// Store in lowercase for case-insensitive matching
			insertStmt.run(password.toLowerCase().trim());
		}
	});

	console.log('Inserting passwords into database...');
	const startTime = Date.now();
	insertMany(passwords);
	const endTime = Date.now();

	// Verify count
	const count = db.prepare('SELECT COUNT(*) as count FROM trivial_passwords').get() as { count: number };

	console.log(`✓ Successfully loaded ${count.count} unique passwords in ${endTime - startTime}ms`);
} catch (error) {
	console.error('Error loading passwords:', error);
	process.exit(1);
}
