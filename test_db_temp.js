import { Client, Databases } from 'node-appwrite';

const client = new Client()
    .setEndpoint('https://nyc.cloud.appwrite.io/v1')
    .setProject('6a084d8900251e5c0f6e')
    .setKey('standard_0d4700d805c549e4289f2075a05c0c074d7f6b2d70f6f27a380288366ae70cd28f1a3af9ca000b97617f8aae2b6b32d4910d2ee67c377eb170527e26e5e3cda260bdbf345315935037f10bbfd186e597a1f2d4fc6112c1ac9527f32d906c70bba7d7736dc32da31d44b77810d283f9f36108bfb2f342ca441f85ab2d3b6a50c7');

const databases = new Databases(client);
const DATABASE_ID = '6a084e9b00061aea385a';

async function run() {
  try {
    const classes = await databases.listDocuments(DATABASE_ID, 'classes');
    console.log("=== CLASSES ===");
    classes.documents.forEach(doc => {
      console.log(`ID: ${doc.$id}, Label: ${doc.label}, MentorID: ${doc.mentor_id}, ChatEnabled: ${doc.chat_enabled}, ChatAdditionalMembers: ${JSON.stringify(doc.chat_additional_members)}`);
    });

    const students = await databases.listDocuments(DATABASE_ID, 'students');
    console.log("\n=== STUDENTS ===");
    students.documents.forEach(doc => {
      console.log(`ID: ${doc.$id}, Name: ${doc.name}, ClassID: ${doc.class_id}, Email: ${doc.email}, UID: ${doc.uid}`);
    });

    const userRoles = await databases.listDocuments(DATABASE_ID, 'userRoles');
    console.log("\n=== USER ROLES ===");
    userRoles.documents.forEach(doc => {
      console.log(`ID: ${doc.$id}, Name: ${doc.name}, Role: ${doc.role}, UID: ${doc.uid}`);
    });

    const teachers = await databases.listDocuments(DATABASE_ID, 'teachers');
    console.log("\n=== TEACHERS ===");
    teachers.documents.forEach(doc => {
      console.log(`ID: ${doc.$id}, Name: ${doc.name}, UID: ${doc.uid}, Assignments: ${doc.class_assignments}`);
    });
  } catch (e) {
    console.error(e);
  }
}

run();
