/**
 * Reset script: Purge all user-related documents and recreate the admin account.
 * Uses the node-appwrite SERVER SDK with an API key for privileged access.
 */
import 'dotenv/config';
import { Client, Databases, Users, Query, ID } from 'node-appwrite';

// Load env vars
const ENDPOINT = process.env.VITE_APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.VITE_APPWRITE_PROJECT_ID;
const DATABASE_ID = process.env.VITE_APPWRITE_DATABASE_ID;
const API_KEY = process.env.APPWRITE_API_KEY;

if (!ENDPOINT || !PROJECT_ID || !DATABASE_ID || !API_KEY) {
  console.error('Missing required env vars. Make sure .env has:');
  console.error('  VITE_APPWRITE_ENDPOINT, VITE_APPWRITE_PROJECT_ID, VITE_APPWRITE_DATABASE_ID, APPWRITE_API_KEY');
  process.exit(1);
}

// Create server-side client with API key
const client = new Client();
client.setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);

const databases = new Databases(client);
const users = new Users(client);

const ADMIN_USN = 'admin';
const ADMIN_PASSWORD = '12345678';
const ADMIN_EMAIL = `${ADMIN_USN}@campustwin.edu`;

// ── Step 1: Delete all documents from user-related collections ──
async function deleteAllDocuments() {
  const collections = ['students', 'teachers', 'admins', 'userRoles'];
  for (const col of collections) {
    try {
      const response = await databases.listDocuments(DATABASE_ID, col, [Query.limit(100)]);
      console.log(`Found ${response.documents.length} docs in "${col}"`);
      for (const doc of response.documents) {
        await databases.deleteDocument(DATABASE_ID, col, doc.$id);
        console.log(`  Deleted ${col}/${doc.$id}`);
      }
    } catch (e) {
      console.warn(`  Skipped "${col}": ${e.message}`);
    }
  }
}

// ── Step 2: Delete all auth users ──
async function deleteAllAuthUsers() {
  try {
    const response = await users.list();
    console.log(`\nFound ${response.users.length} auth users`);
    for (const user of response.users) {
      await users.delete(user.$id);
      console.log(`  Deleted auth user ${user.name || user.email} (${user.$id})`);
    }
  } catch (e) {
    console.warn(`  Error listing/deleting auth users: ${e.message}`);
  }
}

// ── Step 3: Create fresh admin ──
async function createAdmin() {
  try {
    // Create auth user via server SDK
    const user = await users.create(ID.unique(), ADMIN_EMAIL, undefined, ADMIN_PASSWORD, ADMIN_USN);
    const uid = user.$id;
    console.log(`\nCreated admin auth user: ${uid}`);

    // Insert role record
    await databases.createDocument(DATABASE_ID, 'userRoles', uid, {
      name: ADMIN_USN,
      role: 'admin',
      usn: ADMIN_USN,
      uid: uid,
      createdAt: new Date().toISOString()
    });
    console.log(`  Inserted userRoles record for admin`);

    // Insert admin profile
    await databases.createDocument(DATABASE_ID, 'admins', uid, {
      name: ADMIN_USN,
      usn: ADMIN_USN,
      uid: uid,
      email: ADMIN_EMAIL,
      role: 'admin',
      createdAt: new Date().toISOString()
    });
    console.log(`  Inserted admins profile`);

    console.log(`\n✅ Admin account ready!`);
    console.log(`   Email:    ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
  } catch (e) {
    console.error(`Error creating admin: ${e.message}`);
  }
}

// ── Main ──
async function main() {
  console.log('=== Campus Twin: User Reset ===\n');
  await deleteAllDocuments();
  await deleteAllAuthUsers();
  await createAdmin();
  console.log('\n=== Done ===');
  process.exit(0);
}

main();
