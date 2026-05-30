import { Client, Databases, Permission, Role } from 'node-appwrite';

const client = new Client()
    .setEndpoint('https://nyc.cloud.appwrite.io/v1')
    .setProject('6a084d8900251e5c0f6e')
    .setKey('standard_0d4700d805c549e4289f2075a05c0c074d7f6b2d70f6f27a380288366ae70cd28f1a3af9ca000b97617f8aae2b6b32d4910d2ee67c377eb170527e26e5e3cda260bdbf345315935037f10bbfd186e597a1f2d4fc6112c1ac9527f32d906c70bba7d7736dc32da31d44b77810d283f9f36108bfb2f342ca441f85ab2d3b6a50c7');

const databases = new Databases(client);
const DATABASE_ID = '6a084e9b00061aea385a';

const schemas = {
  students: { uid: 255, usn: 255, name: 255, email: 255, class_id: 255, roll_no: 255, createdAt: 255 },
  teachers: { uid: 255, name: 255, email: 255, department: 255, class_assignments: 255, createdAt: 255 },
  admins: { uid: 255, name: 255, email: 255, createdAt: 255 },
  classes: { class_id: 255, name: 255, semester: 255, advisor_id: 255, createdAt: 255 },
  attendance: { student_id: 255, class_id: 255, subject: 255, date: 255, status: 255, marked_by: 255, createdAt: 255 },
  aictePoints: { student_id: 255, activity_name: 255, category: 255, points: 'integer', date: 255, proof_url: 2000, status: 255, mentor_id: 255, remarks: 1000, semester: 255, createdAt: 255 },
  leaveRequests: { student_id: 255, reason: 4000, from_date: 255, to_date: 255, proof_url: 2000, status: 255, applied_at: 255, createdAt: 255 },
  complaints: { user_id: 255, message: 4000, category: 255, image_url: 2000, createdAt: 255, status: 255 },
  events: { title: 255, description: 4000, date: 255, venue: 255, image_url: 2000, organizer: 255, target_audience: 255, createdAt: 255 },
  timetable: { class_id: 255, day: 255, time: 255, subject: 255, teacher: 255, room: 255, status: 255, createdAt: 255 },
  comments: { timetable_id: 255, student_id: 255, comment_text: 4000, suggested_change: 4000, status: 255, createdAt: 255 },
  marks: { student_id: 255, exam_type: 255, subject: 255, marks_obtained: 255, max_marks: 255, semester: 255, createdAt: 255 },
  marksCards: { student_id: 255, semester: 255, exam_type: 255, pdf_url: 2000, uploaded_at: 255, uploaded_by: 255, createdAt: 255 },
  notifications: { user_id: 255, message: 4000, read_status: 'boolean', createdAt: 255 },
  changelogs: { timetable_id: 255, action: 255, details: 4000, changed_by: 255, createdAt: 255 },
  userRoles: { name: 255, role: 255, usn: 255, uid: 255, createdAt: 255 },
  class_messages: { class_id: 255, sender_id: 255, sender_name: 255, sender_role: 255, message: 5000, timestamp: 255, file_url: 2000, file_type: 255, file_name: 255 },
  subjects: { courseCode: 255, courseName: 255, courseShortName: 255, credits: 'integer', branch_id: 255, is_lab_integrated: 'boolean', createdAt: 255 },
  subjectAllocations: { class_id: 255, subject_id: 255, semester: 255, createdAt: 255 },
  branches: { name: 255, code: 255, createdAt: 255 }
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
  console.log("Starting DB Schema creation...");

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
          console.log(`  Added attribute: ${attrName}`);
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

  console.log("DB Schema Setup Complete!");
}

run();
