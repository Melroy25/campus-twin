import { Client, Databases, Permission, Role } from 'node-appwrite';

const client = new Client()
    .setEndpoint('https://nyc.cloud.appwrite.io/v1')
    .setProject('6a084d8900251e5c0f6e')
    .setKey('standard_0d4700d805c549e4289f2075a05c0c074d7f6b2d70f6f27a380288366ae70cd28f1a3af9ca000b97617f8aae2b6b32d4910d2ee67c377eb170527e26e5e3cda260bdbf345315935037f10bbfd186e597a1f2d4fc6112c1ac9527f32d906c70bba7d7736dc32da31d44b77810d283f9f36108bfb2f342ca441f85ab2d3b6a50c7');

const databases = new Databases(client);
const DATABASE_ID = '6a084e9b00061aea385a';
const colName = 'cabinetSettings';

const permissions = [
  Permission.create(Role.any()),
  Permission.read(Role.any()),
  Permission.update(Role.any()),
  Permission.delete(Role.any())
];

async function run() {
  console.log(`Setting up ${colName} Collection...`);

  let collectionExists = false;
  try {
    await databases.getCollection(DATABASE_ID, colName);
    collectionExists = true;
  } catch (e) {
    if (e.code !== 404) console.log(e.message);
  }

  try {
    if (!collectionExists) {
      await databases.createCollection(DATABASE_ID, colName, colName, permissions);
      console.log(` Created collection ${colName}`);
      await new Promise(r => setTimeout(r, 500));
    } else {
      console.log(` Collection ${colName} already exists, updating permissions...`);
      await databases.updateCollection(DATABASE_ID, colName, colName, permissions);
    }

    // Add attributes
    const attributes = {
      uid: 255,
      password_hash: 1000,
      encrypted_password: 2000,
      createdAt: 255
    };

    for (const [attrName, attrType] of Object.entries(attributes)) {
      try {
        await databases.createStringAttribute(DATABASE_ID, colName, attrName, attrType, false);
        console.log(`  Added attribute: ${attrName}`);
        await new Promise(r => setTimeout(r, 200)); 
      } catch (err) {
        if (err.code !== 409) console.error(`  Error adding attribute ${attrName}:`, err.message);
      }
    }

    // Add boolean attribute reset_requested
    try {
      await databases.createBooleanAttribute(DATABASE_ID, colName, 'reset_requested', false, false);
      console.log("  Added boolean attribute: reset_requested");
    } catch (err) {
      if (err.code !== 409) console.error("  Error adding attribute reset_requested:", err.message);
    }

  } catch (err) {
    console.error(`Error processing collection ${colName}:`, err.message);
  }

  console.log("Setup complete!");
}

run();
