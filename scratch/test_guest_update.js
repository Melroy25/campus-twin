import { Client, Databases } from 'appwrite'; // Use the client SDK, not node-appwrite!

const client = new Client()
    .setEndpoint('https://nyc.cloud.appwrite.io/v1')
    .setProject('6a084d8900251e5c0f6e');

const databases = new Databases(client);
const DATABASE_ID = '6a084e9b00061aea385a';

async function run() {
  const docId = '6a2a5ee80003142b7d47';
  console.log(`[Guest client] Inspecting/updating attendance document: ${docId}`);
  try {
    const doc = await databases.getDocument(DATABASE_ID, 'placementAttendance', docId);
    console.log("Document found:", JSON.stringify(doc, null, 2));

    console.log("Attempting to update status as guest...");
    const updated = await databases.updateDocument(DATABASE_ID, 'placementAttendance', docId, {
      status: 'condoned',
      marked_at: new Date().toISOString()
    });
    console.log("Update success!", JSON.stringify(updated, null, 2));
  } catch (err) {
    console.error("Error operations on attendance document:", err);
  }
}

run();
