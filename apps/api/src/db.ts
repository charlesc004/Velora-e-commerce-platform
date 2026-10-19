import mongoose from 'mongoose';
import { config } from './config.js';

export async function connectDatabase(uri = config.MONGODB_URI): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
