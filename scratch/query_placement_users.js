import { Client, Databases } from 'node-appwrite';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const client = new Client()
    .setEndpoint('https://nyc.cloud.appwrite.io/v1')
    .setProject('6a084d8900251e5c0f6e')
    .setKey(process.env.APPWRITE_API_KEY || 'standard_0d4700d805c549e4289f2075a05c0c074d7f6b2d70f6f27a380288366ae70cd28f1a3af9ca000b97617f8aae2b6b32d4910d2ee67c377eb170527e26e5e3cda260bdbf345315935037f10bbfd186e597a1f2d4fc6112c1ac9527f32d906c70bba7d7736dc32da31d44b77810d283f9f36108bfb2f342ca441f85ab2d3b6a50c7');

const databases = new Databases(client);
const DATABASE_ID = '6a084e9b00061aea385a';

async function run() {
  try {
    console.log("=== PLACEMENT USERS ===");
    const res = await databases.listDocuments(DATABASE_ID, 'placementUsers');
    res.documents.forEach(doc => {
      console.log(`ID: ${doc.$id}, Username: ${doc.username}, Role: ${doc.role}, Password Hash: ${doc.password}`);
    });

    console.log("\n=== PLACEMENT STAFF ===");
    const staffRes = await databases.listDocuments(DATABASE_ID, 'placementStaff');
    staffRes.documents.forEach(doc => {
      console.log(`ID: ${doc.$id}, Name: ${doc.name}, Username: ${doc.username}, Type: ${doc.type}, Password Hash: ${doc.password}`);
    });

    const testHash = crypto.createHash('sha256').update('placement').digest('hex');
    console.log(`\nTest Hash for 'placement': ${testHash}`);

  } catch (err) {
    console.error("Error querying database:", err.message);
  }
}

run();
