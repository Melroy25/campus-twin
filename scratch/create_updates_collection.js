import { Client, Databases, Permission, Role } from 'node-appwrite';

const client = new Client()
    .setEndpoint('https://nyc.cloud.appwrite.io/v1')
    .setProject('6a084d8900251e5c0f6e')
    .setKey('standard_0d4700d805c549e4289f2075a05c0c074d7f6b2d70f6f27a380288366ae70cd28f1a3af9ca000b97617f8aae2b6b32d4910d2ee67c377eb170527e26e5e3cda260bdbf345315935037f10bbfd186e597a1f2d4fc6112c1ac9527f32d906c70bba7d7736dc32da31d44b77810d283f9f36108bfb2f342ca441f85ab2d3b6a50c7');

const databases = new Databases(client);
const DATABASE_ID = '6a084e9b00061aea385a';

async function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function run() {
  const colName = 'timetable_updates';
  const permissions = [
    Permission.create(Role.any()),
    Permission.read(Role.any()),
    Permission.update(Role.any()),
    Permission.delete(Role.any())
  ];

  let colExists = false;
  try {
    await databases.getCollection(DATABASE_ID, colName);
    colExists = true;
    console.log("ℹ️ timetable_updates collection already exists");
  } catch (e) {
    if (e.code !== 404) console.log(e.message);
  }

  if (!colExists) {
    try {
      console.log(`Creating collection ${colName}...`);
      await databases.createCollection(DATABASE_ID, colName, colName, permissions);
      console.log(`✅ Created collection ${colName}`);
      await delay(1000);

      const attributes = {
        class_id: 255,
        message: 4000,
        author_id: 255,
        author_name: 255,
        author_role: 255,
        createdAt: 255
      };

      for (const [attrName, size] of Object.entries(attributes)) {
        await databases.createStringAttribute(DATABASE_ID, colName, attrName, size, false);
        console.log(`  Added attribute: ${attrName}`);
        await delay(500);
      }
      console.log("Collection timetable_updates initialized fully with attributes!");
    } catch (err) {
      console.error(`❌ Error setting up ${colName}:`, err.message);
    }
  }
}

run();
