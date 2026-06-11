import { Client, Databases } from 'appwrite';

const client = new Client()
    .setEndpoint('https://nyc.cloud.appwrite.io/v1')
    .setProject('6a084d8900251e5c0f6e');

const databases = new Databases(client);
const DATABASE_ID = '6a084e9b00061aea385a';

async function run() {
  const docId = '6a2a5ee60016207e7489';
  console.log(`[Guest client] Updating document: ${docId}`);
  try {
    const updated = await databases.updateDocument(DATABASE_ID, 'placementAttendance', docId, {
      status: 'condoned',
      marked_at: new Date().toISOString()
    });
    console.log("Update success!", JSON.stringify(updated, null, 2));
  } catch (err) {
    console.error("Update failed:", err);
  }
}

run();
