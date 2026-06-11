import { Client, Databases } from 'node-appwrite';

const client = new Client()
    .setEndpoint('https://nyc.cloud.appwrite.io/v1')
    .setProject('6a084d8900251e5c0f6e')
    .setKey(process.env.APPWRITE_API_KEY || 'standard_0d4700d805c549e4289f2075a05c0c074d7f6b2d70f6f27a380288366ae70cd28f1a3af9ca000b97617f8aae2b6b32d4910d2ee67c377eb170527e26e5e3cda260bdbf345315935037f10bbfd186e597a1f2d4fc6112c1ac9527f32d906c70bba7d7736dc32da31d44b77810d283f9f36108bfb2f342ca441f85ab2d3b6a50c7');

const databases = new Databases(client);
const DATABASE_ID = '6a084e9b00061aea385a';
const COLLECTION_ID = 'placementSessions';

async function run() {
  console.log("Adding 'assigned_teachers' attribute to 'placementSessions' collection...");
  try {
    await databases.createStringAttribute(DATABASE_ID, COLLECTION_ID, 'assigned_teachers', 2000, false);
    console.log("assigned_teachers attribute successfully added to placementSessions!");
  } catch (err) {
    if (err.code === 409) {
      console.log("assigned_teachers attribute already exists.");
    } else {
      console.error("Error creating attribute:", err.message);
    }
  }
}

run();
