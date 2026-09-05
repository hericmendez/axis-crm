/**
 * Runtime validation for Google Integration Provisioner.
 *
 * This script:
 * 1. Connects to MongoDB (no auth)
 * 2. Creates a GoogleConnection with a real refresh token
 * 3. Runs provision() twice to test idempotency
 * 4. Verifies resources were created
 *
 * Usage:
 *   npx tsx scripts/provisioner-runtime-test.ts <refreshToken>
 *
 * The refresh token must be from a real OAuth flow with the scopes:
 *   - calendar
 *   - spreadsheets
 *   - drive.file
 */

import mongoose from 'mongoose';
import { provision } from '../src/integrations/google/provisioner.js';
import { GoogleConnectionModel } from '../src/models/google-connection.model.js';
import { UserModel } from '../src/models/user.model.js';

const REFRESH_TOKEN = process.argv[2];

async function main() {
	if (!REFRESH_TOKEN) {
		console.error('Usage: npx tsx scripts/provisioner-runtime-test.ts <refreshToken>');
		console.error('');
		console.error('The refresh token must be from a real OAuth flow with scopes:');
		console.error('  - calendar');
		console.error('  - spreadsheets');
		console.error('  - drive.file');
		process.exit(1);
	}

	// Connect to MongoDB (no auth for local testing)
	const mongoUri = 'mongodb://localhost:27017/crm-whatsapp';
	await mongoose.connect(mongoUri);
	console.log('Connected to MongoDB');

	// Create or find test user
	const testApiKey = `test-provisioner-${Date.now()}`;
	const user = await UserModel.create({
		name: 'Provisioner Test User',
		apiKey: testApiKey,
	});
	const userId = (user._id as mongoose.Types.ObjectId).toString();
	console.log(`Created test user: ${userId}`);

	// Create GoogleConnection
	const connection = await GoogleConnectionModel.create({
		userId,
		email: 'test@example.com',
		refreshToken: REFRESH_TOKEN,
	});
	console.log('Created GoogleConnection');

	// First provision
	console.log('\n=== First provision ===');
	const result1 = await provision(userId);
	console.log('Result:', JSON.stringify(result1, null, 2));

	// Verify resources
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

	// Second provision (idempotency check)
	console.log('\n=== Second provision (idempotency) ===');
	const result2 = await provision(userId);
	console.log('Result:', JSON.stringify(result2, null, 2));

	const isIdempotent = result1.calendarId === result2.calendarId && result1.spreadsheetId === result2.spreadsheetId;
	console.log(`\nIdempotent: ${isIdempotent ? '✅ YES' : '❌ NO'}`);

	if (!isIdempotent) {
		console.error('ERROR: Provisioner is not idempotent!');
		process.exit(1);
	}

	// Verify persisted state
	const finalConnection = await GoogleConnectionModel.findOne({ userId }).lean();
	console.log('\n=== Final GoogleConnection state ===');
	console.log(`calendarId: ${finalConnection?.calendarId ?? '(none)'}`);
	console.log(`spreadsheetId: ${finalConnection?.spreadsheetId ?? '(none)'}`);

	// Cleanup test data (but keep resources in Google)
	await GoogleConnectionModel.deleteOne({ userId });
	await UserModel.deleteOne({ _id: userId });
	console.log('\nCleaned up test data');

	await mongoose.disconnect();
	console.log('Done.');
}

main().catch((err) => {
	console.error('Fatal error:', err);
	process.exit(1);
});
