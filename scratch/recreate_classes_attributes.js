import { Client, Databases } from 'node-appwrite';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client()
    .setEndpoint(process.env.VITE_APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1')
    .setProject(process.env.VITE_APPWRITE_PROJECT_ID || '6a084d8900251e5c0f6e')
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const DATABASE_ID = process.env.VITE_APPWRITE_DATABASE_ID || '6a084e9b00061aea385a';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  try {
    console.log("Starting schema optimization for classes collection...");

    const attrsToDelete = ['class_id', 'name', 'semester'];
    for (const attr of attrsToDelete) {
      try {
        console.log(`Deleting attribute '${attr}'...`);
        await databases.deleteAttribute(DATABASE_ID, 'classes', attr);
        console.log(`SUCCESS: Deleted attribute '${attr}'`);
        await delay(2000); // Wait for Appwrite to process the deletion asynchronously
      } catch (err) {
        console.error(`Error deleting attribute '${attr}':`, err.message || err);
      }
    }

    console.log("Waiting a bit longer to ensure deletions are complete on the database server...");
    await delay(5000);

    console.log("Creating subject_ids attribute...");
    await databases.createStringAttribute(DATABASE_ID, 'classes', 'subject_ids', 2000, false);
    console.log("SUCCESS: subject_ids attribute created successfully!");

  } catch (err) {
    console.error("Critical Error during execution:", err.message || err);
  }
}

run();
