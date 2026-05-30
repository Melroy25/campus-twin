import { Client, Databases, Permission, Role } from 'node-appwrite';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client()
    .setEndpoint(process.env.VITE_APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1')
    .setProject(process.env.VITE_APPWRITE_PROJECT_ID || '6a084d8900251e5c0f6e')
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const DATABASE_ID = process.env.VITE_APPWRITE_DATABASE_ID || '6a084e9b00061aea385a';
const COLLECTION_NAME = 'aictePdfs';

async function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function run() {
  console.log("Checking / Creating aictePdfs collection in Appwrite...");
  let collectionExists = false;
  try {
    await databases.getCollection(DATABASE_ID, COLLECTION_NAME);
    collectionExists = true;
    console.log("Collection aictePdfs already exists!");
  } catch (e) {
    if (e.code !== 404) {
      console.error(e.message);
    }
  }

  const permissions = [
    Permission.create(Role.any()),
    Permission.read(Role.any()),
    Permission.update(Role.any()),
    Permission.delete(Role.any())
  ];

  if (!collectionExists) {
    try {
      await databases.createCollection(DATABASE_ID, COLLECTION_NAME, COLLECTION_NAME, permissions);
      console.log("Created collection aictePdfs successfully.");
      await delay(1000);

      // Create attributes
      console.log("Adding attributes...");
      await databases.createStringAttribute(DATABASE_ID, COLLECTION_NAME, 'title', 255, false);
      console.log("Added attribute: title");
      await delay(500);

      await databases.createStringAttribute(DATABASE_ID, COLLECTION_NAME, 'pdf_url', 2000, false);
      console.log("Added attribute: pdf_url");
      await delay(500);

      await databases.createStringAttribute(DATABASE_ID, COLLECTION_NAME, 'uploaded_at', 255, false);
      console.log("Added attribute: uploaded_at");
      await delay(500);

      console.log("AICTE PDF Collection Setup Complete!");
    } catch (err) {
      console.error("Error creating collection or attributes:", err.message);
    }
  }
}

run();
