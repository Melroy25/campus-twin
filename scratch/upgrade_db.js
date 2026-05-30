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
  console.log("Upgrading Appwrite database schema...");

  // 1. Add admin_reply to complaints
  try {
    console.log("Adding admin_reply to complaints...");
    await databases.createStringAttribute(DATABASE_ID, 'complaints', 'admin_reply', 4000, false);
    console.log("✅ Added admin_reply to complaints");
  } catch (e) {
    if (e.code === 409) {
      console.log("ℹ️ admin_reply already exists on complaints");
    } else {
      console.error("❌ Error adding admin_reply to complaints:", e.message);
    }
  }

  // 2. Add teacher_reply to leaveRequests
  try {
    console.log("Adding teacher_reply to leaveRequests...");
    await databases.createStringAttribute(DATABASE_ID, 'leaveRequests', 'teacher_reply', 4000, false);
    console.log("✅ Added teacher_reply to leaveRequests");
  } catch (e) {
    if (e.code === 409) {
      console.log("ℹ️ teacher_reply already exists on leaveRequests");
    } else {
      console.error("❌ Error adding teacher_reply to leaveRequests:", e.message);
    }
  }

  // 3. Add time to events
  try {
    console.log("Adding time to events...");
    await databases.createStringAttribute(DATABASE_ID, 'events', 'time', 255, false);
    console.log("✅ Added time to events");
  } catch (e) {
    if (e.code === 409) {
      console.log("ℹ️ time already exists on events");
    } else {
      console.error("❌ Error adding time to events:", e.message);
    }
  }

  // 4. Create event_registrations collection
  const colName = 'event_registrations';
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
    console.log("ℹ️ event_registrations collection already exists");
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
        event_id: 255,
        student_id: 255,
        student_name: 255,
        student_usn: 255,
        registeredAt: 255
      };

      for (const [attrName, size] of Object.entries(attributes)) {
        await databases.createStringAttribute(DATABASE_ID, colName, attrName, size, false);
        console.log(`  Added attribute: ${attrName}`);
        await delay(500);
      }
    } catch (err) {
      console.error(`❌ Error setting up ${colName}:`, err.message);
    }
  }

  console.log("Schema Upgrade Complete!");
}

run();
