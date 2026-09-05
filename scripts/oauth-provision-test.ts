#!/usr/bin/env npx tsx
/**
 * Manual OAuth + Provisioner Runtime Test
 *
 * This script:
 * 1. Generates Google OAuth authorization URL
 * 2. Exchanges code for tokens
 * 3. Creates GoogleConnection
 * 4. Runs provision() to create Calendar + Spreadsheet
 * 5. Verifies idempotency
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/oauth-provision-test.ts
 *
 * Follow the prompts to complete the OAuth flow.
 */

import mongoose from 'mongoose';
import { google } from 'googleapis';
import { GoogleConnectionModel } from '../src/models/google-connection.model.js';
import { UserModel } from '../src/models/user.model.js';
import { provision } from '../src/integrations/google/provisioner.js';
import { getEnv } from '../src/config/env.js';
import * as readline from 'readline';

const env = getEnv();

function generateAuthUrl(): string {
	const oauth2Client = new google.auth.OAuth2(
		env.GOOGLE_OAUTH_CLIENT_ID,
		env.GOOGLE_OAUTH_CLIENT_SECRET,
		env.GOOGLE_OAUTH_REDIRECT_URI,
	);

	const scopes = [
		'https://www.googleapis.com/auth/calendar',
		'https://www.googleapis.com/auth/spreadsheets',
		'https://www.googleapis.com/auth/drive.file',
	];

	return oauth2Client.generateAuthUrl({
		access_type: 'offline',
		scope: scopes,
		prompt: 'consent',
	});
}

async function exchangeCodeForTokens(code: string): Promise<string> {
	const oauth2Client = new google.auth.OAuth2(
		env.GOOGLE_OAUTH_CLIENT_ID,
		env.GOOGLE_OAUTH_CLIENT_SECRET,
		env.GOOGLE_OAUTH_REDIRECT_URI,
	);

	const { tokens } = await oauth2Client.getToken(code);
	return tokens.refresh_token!;
}

async function main() {
	// Connect to MongoDB
	await mongoose.connect('mongodb://localhost:27017/crm-whatsapp');
	console.log('Connected to MongoDB');

	// Clean up any previous test data
	await GoogleConnectionModel.deleteMany({ email: 'oauth-test@provisioner-test.local' });
	await UserModel.deleteMany({ name: 'OAuth Provisioner Test User' });

	// Create test user
	const apiKey = `test-oauth-${Date.now()}`;
	const user = await UserModel.create({
		name: 'OAuth Provisioner Test User',
		apiKey,
	});
	const userId = (user._id as mongoose.Types.ObjectId).toString();
	console.log(`Created test user: ${userId}`);

	// Step 1: Generate authorization URL
	const authUrl = generateAuthUrl();
	console.log('\n=== STEP 1: Authorization URL ===');
	console.log('Open this URL in your browser:\n');
	console.log(authUrl);
	console.log('\nAfter authorizing, copy the code from the redirect URL.');

	// Step 2: Get authorization code from user
	const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
	const code = await new Promise<string>((resolve) => {
		rl.question('\nEnter the authorization code: ', (answer) => {
			rl.close();
			resolve(answer.trim());
		});
	});

	// Step 3: Exchange code for refresh token
	console.log('\n=== STEP 2: Exchanging code for tokens ===');
	const refreshToken = await exchangeCodeForTokens(code);
	console.log('Refresh token obtained (not displayed for security)');

	// Step 4: Create GoogleConnection
	console.log('\n=== STEP 3: Creating GoogleConnection ===');
	const connection = await GoogleConnectionModel.create({
		userId,
		email: 'oauth-test@provisioner-test.local',
		refreshToken,
	});
	console.log('GoogleConnection created');

	// Step 5: Run provisioner
	console.log('\n=== STEP 4: First provision ===');
	const result1 = await provision(userId);
	console.log('Result:', JSON.stringify(result1, null, 2));

	// Verify
	if (result1.calendarId) {
		console.log(`✅ Calendar created: ${result1.calendarId}`);
	} else {
		console.log('❌ Calendar creation failed');
	}

	if (result1.spreadsheetId) {
		console.log(`✅ Spreadsheet created: ${result1.spreadsheetId}`);
	} else {
		console.log('❌ Spreadsheet creation failed');
	}

	// Step 6: Idempotency check
	console.log('\n=== STEP 5: Second provision (idempotency) ===');
	const result2 = await provision(userId);
	console.log('Result:', JSON.stringify(result2, null, 2));

	const isIdempotent = result1.calendarId === result2.calendarId && result1.spreadsheetId === result2.spreadsheetId;
	console.log(`\nIdempotency: ${isIdempotent ? '✅ PASS' : '❌ FAIL'}`);

	if (!isIdempotent) {
		console.error('ERROR: Provisioner is not idempotent!');
		process.exit(1);
	}

	// Step 7: Verify persisted state
	console.log('\n=== STEP 6: Final GoogleConnection state ===');
	const finalConnection = await GoogleConnectionModel.findOne({ userId }).lean();
	console.log(`calendarId: ${finalConnection?.calendarId ?? '(none)'}`);
	console.log(`spreadsheetId: ${finalConnection?.spreadsheetId ?? '(none)'}`);

	// Verify both IDs are persisted
	if (finalConnection?.calendarId && finalConnection?.spreadsheetId) {
		console.log('\n✅ Both IDs persisted in MongoDB');
	} else {
		console.log('\n❌ IDs not persisted');
		process.exit(1);
	}

	// Cleanup test user (keep GoogleConnection for manual verification)
	await UserModel.deleteOne({ _id: userId });
	console.log('\nCleaned up test user');

	await mongoose.disconnect();
	console.log('\nDone. Please verify in Google:');
	console.log('  - Calendar: "Axis CRM" should exist as secondary calendar');
	console.log('  - Sheets: "Axis CRM" should exist with "Leads" tab');
}

main().catch((err) => {
	console.error('Fatal error:', err);
	process.exit(1);
});
