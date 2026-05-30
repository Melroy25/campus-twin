import { Client, Databases } from 'node-appwrite';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client()
    .setEndpoint(process.env.VITE_APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1')
    .setProject(process.env.VITE_APPWRITE_PROJECT_ID || '6a084d8900251e5c0f6e')
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

async function run() {
  try {
    const list = await databases.list();
    console.log("Databases count:", list.total);
    for (const db of list.databases) {
      console.log(`DB ID: ${db.$id}, Name: ${db.name}`);
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
