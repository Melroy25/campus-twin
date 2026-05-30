import dotenv from 'dotenv';
dotenv.config();

import { Client, Users, Databases, Query } from 'node-appwrite';

const client = new Client()
  .setEndpoint(process.env.VITE_APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1')
  .setProject(process.env.VITE_APPWRITE_PROJECT_ID || '6a084d8900251e5c0f6e')
  .setKey(process.env.APPWRITE_API_KEY);

const users = new Users(client);
const databases = new Databases(client);

const DB_ID = process.env.VITE_APPWRITE_DATABASE_ID || '6a084e9b00061aea385a';

async function updateEmail() {
  try {
    const usn = '4SO24CS128';
    const newEmail = 'melroyalmeida6@gmail.com';

    // 1. Find user in userRoles collection
    const res = await databases.listDocuments(DB_ID, 'userRoles', [
      Query.equal('usn', usn)
    ]);

    if (res.total === 0) {
      console.log(`User ${usn} not found in database!`);
      return;
    }

    const doc = res.documents[0];
    const uid = doc.uid;
    console.log(`Found user ${usn} with UID ${uid}. Updating email...`);

    // 2. Update userRoles document
    await databases.updateDocument(DB_ID, 'userRoles', doc.$id, {
      email: newEmail
    });
    console.log(`✅ Updated email in userRoles collection`);

    // 3. Update Auth User email
    try {
      await users.updateEmail(uid, newEmail);
      console.log(`✅ Updated email in Auth Provider`);
    } catch (authErr) {
      if (authErr.code === 409) {
         console.log(`⚠️ Email already in use by another Auth user, skipping Auth update.`);
      } else {
         throw authErr;
      }
    }
    
    console.log('Update Complete!');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

updateEmail();
