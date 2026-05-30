import dotenv from 'dotenv';
dotenv.config();

import { Client, Databases } from 'node-appwrite';

const client = new Client()
  .setEndpoint(process.env.VITE_APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1')
  .setProject(process.env.VITE_APPWRITE_PROJECT_ID || '6a084d8900251e5c0f6e')
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const DB_ID = process.env.VITE_APPWRITE_DATABASE_ID || '6a084e9b00061aea385a';

async function addEmailAttr() {
  try {
    console.log('Adding email attribute to userRoles collection...');
    await databases.createStringAttribute(
      DB_ID,
      'userRoles',
      'email',
      255, // size
      false // required
    );
    console.log('✅ Attribute "email" created. Note: Appwrite may take a few seconds to process this change.');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

addEmailAttr();
