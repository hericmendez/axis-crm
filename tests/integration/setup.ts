import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer: MongoMemoryServer | undefined;

export async function startTestMongo(): Promise<string> {
	mongoServer = await MongoMemoryServer.create();
	return mongoServer.getUri('axis-test');
}

export async function stopTestMongo(): Promise<void> {
	await mongoose.disconnect();
	await mongoServer?.stop();
	mongoServer = undefined;
}

export async function clearCollections(): Promise<void> {
	const collections = mongoose.connection.collections;
	for (const collection of Object.values(collections)) {
		await collection.deleteMany({});
	}
}
