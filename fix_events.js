import { Client, Databases, Permission, Role } from 'node-appwrite';

const client = new Client()
    .setEndpoint('https://nyc.cloud.appwrite.io/v1')
    .setProject('6a084d8900251e5c0f6e')
    .setKey('standard_0d4700d805c549e4289f2075a05c0c074d7f6b2d70f6f27a380288366ae70cd28f1a3af9ca000b97617f8aae2b6b32d4910d2ee67c377eb170527e26e5e3cda260bdbf345315935037f10bbfd186e597a1f2d4fc6112c1ac9527f32d906c70bba7d7736dc32da31d44b77810d283f9f36108bfb2f342ca441f85ab2d3b6a50c7');

const databases = new Databases(client);
const DATABASE_ID = '6a084e9b00061aea385a';

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
  console.log("Fixing Events collection...");
  try {
    console.log("Deleting old broken events collection...");
    await databases.deleteCollection(DATABASE_ID, 'events');
    await delay(2000); // wait for deletion to propagate
  } catch(e) {
    console.log("Delete error (might not exist):", e.message);
  }

  try {
    console.log("Creating fresh events collection...");
    await databases.createCollection(DATABASE_ID, 'events', 'events', permissions);
    await delay(1000);

    const attributes = { title: 255, description: 4000, date: 255, venue: 255, image_url: 2000, organizer: 255, target_audience: 255 };

    for (const [attrName, attrType] of Object.entries(attributes)) {
        try {
          await databases.createStringAttribute(DATABASE_ID, 'events', attrName, attrType, false);
          console.log(`  Added attribute: ${attrName}`);
          await delay(200); 
        } catch (err) {
          console.error(`  Error adding attribute ${attrName}:`, err.message);
        }
    }
    console.log("Events collection successfully rebuilt!");
  } catch (err) {
    console.error("Error rebuilding events:", err.message);
  }
}

run();
