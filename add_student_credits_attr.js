import { Client, Databases } from 'node-appwrite';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client()
    .setEndpoint(process.env.VITE_APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1')
    .setProject(process.env.VITE_APPWRITE_PROJECT_ID || '6a084d8900251e5c0f6e')
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const DATABASE_ID = process.env.VITE_APPWRITE_DATABASE_ID || '6a084e9b00061aea385a';

async function run() {
  try {
    console.log("Creating total_credits_required attribute in students collection...");
    // createIntegerAttribute(databaseId, collectionId, key, required, min, max, defaultValue)
    await databases.createIntegerAttribute(DATABASE_ID, 'students', 'total_credits_required', false, 0, 500, 160);
    console.log("Attribute total_credits_required created successfully!");
  } catch (e) {
    console.error("Error creating attribute:", e.message);
  }
}

run();
