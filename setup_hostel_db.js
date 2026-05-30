import { Client, Databases, Permission, Role } from 'node-appwrite';

const client = new Client()
    .setEndpoint('https://nyc.cloud.appwrite.io/v1')
    .setProject('6a084d8900251e5c0f6e')
    .setKey('standard_0d4700d805c549e4289f2075a05c0c074d7f6b2d70f6f27a380288366ae70cd28f1a3af9ca000b97617f8aae2b6b32d4910d2ee67c377eb170527e26e5e3cda260bdbf345315935037f10bbfd186e597a1f2d4fc6112c1ac9527f32d906c70bba7d7736dc32da31d44b77810d283f9f36108bfb2f342ca441f85ab2d3b6a50c7');

const databases = new Databases(client);
const DATABASE_ID = '6a084e9b00061aea385a';

const schemas = {
  hostelUsers: {
    warden_id: 255,
    username: 255,
    password: 255,
    hostel_type: 255, // boys, girls
    assigned_block: 255
  },
  hostelRooms: {
    room_id: 255,
    room_number: 255,
    room_type: 255, // Single, 2 Sharing, 3 Sharing, 4 Sharing
    hostel_type: 255, // boys, girls
    floor: 255,
    capacity: 'integer',
    occupied_count: 'integer',
    availability_status: 255, // Available, Full
    attached_bathroom: 'boolean',
    ac_available: 'boolean',
    description: 1000
  },
  hostelRoomImages: {
    image_id: 255,
    room_id: 255,
    image_url: 2000,
    hostel_type: 255,
    room_type: 255,
    caption: 1000
  },
  hostelComplaints: {
    complaint_id: 255,
    student_id: 255,
    student_name: 255,
    category: 255, // Hostel, Food, Maintenance, Cleaning, Infrastructure
    message: 2000,
    status: 255, // pending, approved, rejected, resolved
    reply_message: 2000,
    hostel_type: 255,
    createdAt: 255
  },
  hostelLeaveRequests: {
    leave_id: 255,
    student_id: 255,
    student_name: 255,
    reason: 2000,
    from_date: 255,
    to_date: 255,
    approval_status: 255, // pending, approved, rejected
    reply: 2000,
    hostel_type: 255,
    createdAt: 255
  },
  hostelBills: {
    bill_id: 255,
    student_id: 255,
    student_name: 255,
    amount: 'integer',
    due_date: 255,
    status: 255, // paid, unpaid
    billing_month: 255,
    description: 1000,
    semester: 255,
    hostel_type: 255,
    receipt_url: 2000,
    transaction_id: 255,
    payment_remarks: 1000,
    createdAt: 255
  },
  hostelMessages: {
    message_id: 255,
    sender_id: 255,
    sender_name: 255,
    sender_role: 255, // student, warden
    message: 4000,
    timestamp: 255,
    hostel_type: 255, // boys, girls
    is_announcement: 'boolean'
  },
  hostelNotices: {
    notice_id: 255,
    title: 255,
    content: 4000,
    is_emergency: 'boolean',
    hostel_type: 255,
    pdf_url: 2000,
    createdAt: 255
  },
  hostelPolls: {
    poll_id: 255,
    question: 1000,
    options: 2000,
    votes: 2000,
    voted_users: 4000,
    hostel_type: 255,
    is_active: 'boolean',
    createdAt: 255
  },
  hostelHelplines: {
    helpline_id: 255,
    label: 255,
    phone: 255,
    email: 255,
    hostel_type: 255,
    createdAt: 255
  }
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
  console.log("Starting Hostel DB Schema creation...");

  for (const [colName, attributes] of Object.entries(schemas)) {
    console.log(`Processing collection: ${colName}`);
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

      // Add attributes
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

  console.log("Hostel DB Schema Setup Complete!");
}

run();
