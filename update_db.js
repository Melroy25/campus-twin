import { Client, Databases, Permission, Role } from 'node-appwrite';

const client = new Client()
    .setEndpoint('https://nyc.cloud.appwrite.io/v1')
    .setProject('6a084d8900251e5c0f6e')
    .setKey('standard_0d4700d805c549e4289f2075a05c0c074d7f6b2d70f6f27a380288366ae70cd28f1a3af9ca000b97617f8aae2b6b32d4910d2ee67c377eb170527e26e5e3cda260bdbf345315935037f10bbfd186e597a1f2d4fc6112c1ac9527f32d906c70bba7d7736dc32da31d44b77810d283f9f36108bfb2f342ca441f85ab2d3b6a50c7');

const databases = new Databases(client);
const DATABASE_ID = '6a084e9b00061aea385a';

const newSchemas = {
  branches: { name: 255, code: 255, maintenance_mode: 'boolean', maintenance_message: 255, maintenance_eta: 255, createdAt: 255 },
  subjects: { courseCode: 255, courseName: 255, credits: 'integer', branch_id: 255, createdAt: 255 },
};

const newAttributes = {
  admins: { branch_id: 255, is_super_admin: 'boolean' },
  userRoles: { branch_id: 255, is_super_admin: 'boolean' },
  students: { branch_id: 255 },
  teachers: { branch_id: 255 },
  classes: { subject_ids: 2000 },
  complaints: { branch_id: 255 }
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
  console.log("Starting DB update...");

  // 1. Delete all students, teachers, and classes
  const toClear = ['students', 'teachers', 'classes'];
  for (const collection of toClear) {
    console.log(`Clearing collection: ${collection}`);
    try {
      const response = await databases.listDocuments(DATABASE_ID, collection);
      for (const doc of response.documents) {
        await databases.deleteDocument(DATABASE_ID, collection, doc.$id);
        console.log(`  Deleted document ${doc.$id} from ${collection}`);
        await delay(100);
      }
    } catch (e) {
      console.error(`Error clearing ${collection}:`, e.message);
    }
  }

  // 2. Create new collections
  for (const [colName, attributes] of Object.entries(newSchemas)) {
    console.log(`Processing new collection: ${colName}`);
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
        await delay(500);
      } else {
        console.log(` Collection ${colName} already exists, updating permissions...`);
        await databases.updateCollection(DATABASE_ID, colName, colName, permissions);
      }

      for (const [attrName, attrType] of Object.entries(attributes)) {
        try {
          if (attrType === 'integer') {
            await databases.createIntegerAttribute(DATABASE_ID, colName, attrName, false);
          } else if (attrType === 'boolean') {
            await databases.createBooleanAttribute(DATABASE_ID, colName, attrName, false);
          } else {
            await databases.createStringAttribute(DATABASE_ID, colName, attrName, attrType, false);
          }
          console.log(`  Added attribute: ${attrName} to ${colName}`);
          await delay(200); 
        } catch (err) {
          if (err.code !== 409) { 
            console.error(`  Error adding attribute ${attrName}:`, err.message);
          }
        }
      }
    } catch (err) {
      console.error(`Error processing collection ${colName}:`, err.message);
    }
  }

  // 3. Add new attributes to existing collections
  for (const [colName, attributes] of Object.entries(newAttributes)) {
    console.log(`Adding new attributes to existing collection: ${colName}`);
    for (const [attrName, attrType] of Object.entries(attributes)) {
      try {
        if (attrType === 'integer') {
          await databases.createIntegerAttribute(DATABASE_ID, colName, attrName, false);
        } else if (attrType === 'boolean') {
          await databases.createBooleanAttribute(DATABASE_ID, colName, attrName, false);
        } else {
          await databases.createStringAttribute(DATABASE_ID, colName, attrName, attrType, false);
        }
        console.log(`  Added attribute: ${attrName} to ${colName}`);
        await delay(200); 
      } catch (err) {
        if (err.code !== 409) { 
          console.error(`  Error adding attribute ${attrName}:`, err.message);
        }
      }
    }
  }

  console.log("DB update Complete!");
}

run();
