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
    console.log("Creating room_number attribute in students collection...");
    // createStringAttribute(databaseId, collectionId, key, size, required, defaultValue, array)
    await databases.createStringAttribute(DATABASE_ID, 'students', 'room_number', 255, false);
    console.log("Attribute room_number created successfully!");
  } catch (e) {
    console.error("Error creating attribute:", e.message);
  }
}

run();
