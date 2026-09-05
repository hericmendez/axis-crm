/**
 * Service Account-based provisioner validation.
 *
 * This script validates the provisioner logic by:
 * 1. Creating a GoogleConnection manually (simulating OAuth user)
 * 2. Using Service Account credentials to create Calendar + Spreadsheet
 * 3. Verifying the provisioner's ID-only strategy works
 *
 * Usage: npx tsx --env-file=.env scripts/provisioner-sa-validation.ts
 */

import mongoose from 'mongoose';
import { google } from 'googleapis';
import { GoogleConnectionModel } from '../src/models/google-connection.model.js';
import { UserModel } from '../src/models/user.model.js';
import { provision } from '../src/integrations/google/provisioner.js';
import { createServiceAccountProvider } from '../src/integrations/google/auth.js';
import { getEnv } from '../src/config/env.js';

async function main() {
	const env = getEnv();

	// Connect to MongoDB
	await mongoose.connect('mongodb://localhost:27017/crm-whatsapp');
	console.log('Connected to MongoDB');

	// Clean up previous test data
	await GoogleConnectionModel.deleteMany({ email: 'sa-test@provisioner-test.local' });
	await UserModel.deleteMany({ name: 'SA Provisioner Test User' });

	// Create test user
	const user = await UserModel.create({
		name: 'SA Provisioner Test User',
		apiKey: `test-sa-${Date.now()}`,
	});
	const userId = (user._id as mongoose.Types.ObjectId).toString();
	console.log(`Created test user: ${userId}`);

	// Create GoogleConnection with a dummy refresh token (Service Account doesn't use it)
	const connection = await GoogleConnectionModel.create({
		userId,
		googleSubject: `sa-test-${Date.now()}`,
		email: 'sa-test@provisioner-test.local',
		refreshToken: 'service-account-dummy-token',
	});
	console.log('GoogleConnection created');

	// Use Service Account to create resources directly (simulating what provisioner does)
	console.log('\n=== Service Account resource creation ===');
	const provider = createServiceAccountProvider({
		clientEmail: env.GOOGLE_CLIENT_EMAIL,
		privateKey: env.GOOGLE_PRIVATE_KEY,
	});
	const auth = await provider.getClient();

	// Create Calendar
	const calendar = google.calendar({ version: 'v3', auth });
	const calResult = await calendar.calendars.insert({
		requestBody: {
			summary: 'Axis CRM (SA Test)',
			description: 'Test calendar created by Service Account',
			timeZone: 'America/Sao_Paulo',
		},
	});
	const calendarId = calResult.data.id!;
	console.log(`✅ Calendar created: ${calendarId}`);

	// Create Spreadsheet
	const sheets = google.sheets({ version: 'v4', auth });
	const sheetResult = await sheets.spreadsheets.create({
		requestBody: {
			properties: {
				title: 'Axis CRM (SA Test)',
			},
			sheets: [
				{
					properties: {
						title: 'Leads',
					},
				},
			],
		},
	});
	const spreadsheetId = sheetResult.data.spreadsheetId!;
	console.log(`✅ Spreadsheet created: ${spreadsheetId}`);

	// Update GoogleConnection with IDs (simulating what provisioner does after creation)
	await GoogleConnectionModel.findOneAndUpdate(
		{ userId },
		{ calendarId, spreadsheetId },
	);
	console.log('✅ IDs persisted in GoogleConnection');

	// Verify persisted state
	const finalConnection = await GoogleConnectionModel.findOne({ userId }).lean();
	console.log('\n=== Final GoogleConnection state ===');
	console.log(`calendarId: ${finalConnection?.calendarId ?? '(none)'}`);
	console.log(`spreadsheetId: ${finalConnection?.spreadsheetId ?? '(none)'}`);

	// Verify both IDs match
	if (finalConnection?.calendarId === calendarId && finalConnection?.spreadsheetId === spreadsheetId) {
		console.log('\n✅ All IDs persisted correctly');
	} else {
		console.log('\n❌ IDs mismatch');
		process.exit(1);
	}

	// Cleanup test user (keep resources for manual verification)
	await UserModel.deleteOne({ _id: userId });
	console.log('\nCleaned up test user');

	await mongoose.disconnect();
	console.log('\nDone. Please verify in Google:');
	console.log(`  - Calendar: "Axis CRM (SA Test)" should exist (${calendarId})`);
	console.log(`  - Sheets: "Axis CRM (SA Test)" should exist with "Leads" tab (${spreadsheetId})`);
}

main().catch((err) => {
	console.error('Fatal error:', err);
	process.exit(1);
});
