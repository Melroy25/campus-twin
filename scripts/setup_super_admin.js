import { Client, Databases, Users, ID, Query } from 'node-appwrite';

const client = new Client()
    .setEndpoint('https://nyc.cloud.appwrite.io/v1')
    .setProject('6a084d8900251e5c0f6e')
    .setKey('standard_0d4700d805c549e4289f2075a05c0c074d7f6b2d70f6f27a380288366ae70cd28f1a3af9ca000b97617f8aae2b6b32d4910d2ee67c377eb170527e26e5e3cda260bdbf345315935037f10bbfd186e597a1f2d4fc6112c1ac9527f32d906c70bba7d7736dc32da31d44b77810d283f9f36108bfb2f342ca441f85ab2d3b6a50c7');

const databases = new Databases(client);
const users = new Users(client);

const DATABASE_ID = '6a084e9b00061aea385a';
const EMAIL = 'admin@campustwin.edu';
const PASSWORD = '12345678';
const NAME = 'Campus Super Admin';

async function run() {
  console.log("Starting Super Admin elevation script...");
  let uid = null;

  try {
    // 1. Search for existing Auth User
    console.log(`Checking if Auth User ${EMAIL} exists...`);
    const usersList = await users.list([Query.equal('email', EMAIL)]);
    if (usersList.total > 0) {
      const user = usersList.users[0];
      uid = user.$id;
      console.log(`Found existing Auth User with UID: ${uid}`);
      // Update password to be sure it is correct
      await users.updatePassword(uid, PASSWORD);
      console.log(`Updated password for existing Auth User to: ${PASSWORD}`);
    } else {
      // 2. Create Auth User
      console.log(`Creating new Auth User: ${EMAIL}...`);
      const user = await users.create(ID.unique(), EMAIL, undefined, PASSWORD, NAME);
      uid = user.$id;
      console.log(`Created new Auth User with UID: ${uid}`);
    }

    const now = new Date().toISOString();

    // 3. Setup/Update 'admins' collection document
    console.log(`Setting up 'admins' document for UID: ${uid}...`);
    let adminExists = false;
    try {
      await databases.getDocument(DATABASE_ID, 'admins', uid);
      adminExists = true;
    } catch (e) {
      if (e.code !== 404) console.warn("Error getting admin doc:", e.message);
    }

    const adminDocData = {
      uid: uid,
      name: NAME,
      email: EMAIL,
      is_super_admin: true,
      branch_id: '',
    };

    if (adminExists) {
      console.log("Updating existing admin document...");
      await databases.updateDocument(DATABASE_ID, 'admins', uid, adminDocData);
      console.log("Admin document updated successfully.");
    } else {
      console.log("Creating new admin document...");
      await databases.createDocument(DATABASE_ID, 'admins', uid, {
        ...adminDocData,
        createdAt: now
      });
      console.log("Admin document created successfully.");
    }

    // 4. Setup/Update 'userRoles' collection document
    console.log(`Setting up 'userRoles' document for UID: ${uid}...`);
    let roleExists = false;
    try {
      await databases.getDocument(DATABASE_ID, 'userRoles', uid);
      roleExists = true;
    } catch (e) {
      if (e.code !== 404) console.warn("Error getting userRoles doc:", e.message);
    }

    const roleDocData = {
      uid: uid,
      name: NAME,
      role: 'admin',
      usn: 'admin',
      is_super_admin: true,
      branch_id: '',
    };

    if (roleExists) {
      console.log("Updating existing userRoles document...");
      await databases.updateDocument(DATABASE_ID, 'userRoles', uid, roleDocData);
      console.log("userRoles document updated successfully.");
    } else {
      console.log("Creating new userRoles document...");
      await databases.createDocument(DATABASE_ID, 'userRoles', uid, {
        ...roleDocData,
        createdAt: now
      });
      console.log("userRoles document created successfully.");
    }

    console.log("\nSUCCESS! Super Admin account elevated successfully!");
    console.log(`Username: admin`);
    console.log(`Password: ${PASSWORD}`);
    console.log(`Email: ${EMAIL}`);

  } catch (err) {
    console.error("ERROR running elevation script:", err.message);
    process.exit(1);
  }
}

run();
