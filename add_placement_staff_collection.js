import { Client, Databases, Permission, Role } from 'node-appwrite';

const client = new Client()
    .setEndpoint('https://nyc.cloud.appwrite.io/v1')
    .setProject('6a084d8900251e5c0f6e')
    .setKey(process.env.APPWRITE_API_KEY || 'standard_0d4700d805c549e4289f2075a05c0c074d7f6b2d70f6f27a380288366ae70cd28f1a3af9ca000b97617f8aae2b6b32d4910d2ee67c377eb170527e26e5e3cda260bdbf345315935037f10bbfd186e597a1f2d4fc6112c1ac9527f32d906c70bba7d7736dc32da31d44b77810d283f9f36108bfb2f342ca441f85ab2d3b6a50c7');

const databases = new Databases(client);
const DATABASE_ID = '6a084e9b00061aea385a';
const COLLECTION_ID = 'placementStaff';

const attributes = {
  staff_id: 255,
  name: 255,
  type: 255,     // 'teacher' or 'speaker'
  email: 255,
  phone: 255,
  username: 255,
  password: 255,
  createdAt: 255
};

const permissions = [
  Permission.create(Role.any()),
  Permission.read(Role.any()),
  Permission.update(Role.any()),
  Permission.delete(Role.any())
];

async function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function run() {
  console.log("Creating 'placementStaff' collection...");
  try {
    await databases.createCollection(DATABASE_ID, COLLECTION_ID, COLLECTION_ID, permissions);
    console.log("Collection created successfully!");
  } catch (err) {
    if (err.code === 409 || err.message?.includes('already exists')) {
      console.log("Collection already exists, proceeding to add attributes...");
    } else {
      console.error("Error creating collection:", err.message);
      return;
    }
  }

  // Add attributes
  for (const [attrName, attrSize] of Object.entries(attributes)) {
    try {
      await databases.createStringAttribute(DATABASE_ID, COLLECTION_ID, attrName, attrSize, false);
      console.log(`  Added attribute: ${attrName}`);
      await delay(200);
    } catch (err) {
      if (err.code === 409 || err.message?.includes('already exists')) {
        console.log(`  Attribute ${attrName} already exists.`);
      } else {
        console.error(`  Error creating attribute ${attrName}:`, err.message);
      }
    }
  }
  console.log("placementStaff collection setup complete!");
}

run();
