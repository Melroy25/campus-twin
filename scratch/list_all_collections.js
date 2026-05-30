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
    console.log("Listing collections...");
    const cols = await databases.listCollections(DATABASE_ID);
    console.log("Collections:", cols.collections.map(c => c.name));
    for (const col of cols.collections) {
      const docs = await databases.listDocuments(DATABASE_ID, col.$id);
      console.log(`Collection ${col.name} has ${docs.total} documents.`);
      if (col.name === 'subjectAllocations') {
        for (const doc of docs.documents) {
          console.log("Allocation Doc:", doc);
        }
      }
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
