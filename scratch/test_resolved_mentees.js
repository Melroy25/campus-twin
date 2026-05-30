import { Client, Databases, Query } from 'node-appwrite';

const client = new Client()
    .setEndpoint('https://nyc.cloud.appwrite.io/v1')
    .setProject('6a084d8900251e5c0f6e')
    .setKey('standard_0d4700d805c549e4289f2075a05c0c074d7f6b2d70f6f27a380288366ae70cd28f1a3af9ca000b97617f8aae2b6b32d4910d2ee67c377eb170527e26e5e3cda260bdbf345315935037f10bbfd186e597a1f2d4fc6112c1ac9527f32d906c70bba7d7736dc32da31d44b77810d283f9f36108bfb2f342ca441f85ab2d3b6a50c7');

const databases = new Databases(client);
const DATABASE_ID = '6a084e9b00061aea385a';

const MENTOR_UID = '6a1111fc00357c5d630b'; // Vishwa Roopa's UID

async function run() {
  try {
    console.log(`Checking mentees for Vishwa Roopa (UID: ${MENTOR_UID})...`);
    
    // 1. Direct assignments
    console.log("\n1. Fetching direct students...");
    const directRes = await databases.listDocuments(DATABASE_ID, 'students', [
      Query.equal('mentor_id', MENTOR_UID)
    ]);
    console.log(`Found ${directRes.documents.length} direct students.`);

    // 2. Class assignments
    console.log("\n2. Fetching classes mentored...");
    const classesRes = await databases.listDocuments(DATABASE_ID, 'classes', [
      Query.equal('mentor_id', MENTOR_UID)
    ]);
    console.log(`Found ${classesRes.documents.length} mentored classes.`);
    classesRes.documents.forEach(c => {
      console.log(`- Class: ${c.label} (ID: ${c.$id})`);
    });

    // 3. Students in those classes
    console.log("\n3. Fetching students in mentored classes...");
    let classStudents = [];
    for (const cls of classesRes.documents) {
      const studRes = await databases.listDocuments(DATABASE_ID, 'students', [
        Query.equal('class_id', cls.$id)
      ]);
      console.log(`- Found ${studRes.documents.length} students in class ${cls.label}`);
      classStudents = classStudents.concat(studRes.documents);
    }

    // Merge lists
    const mergedMap = new Map();
    directRes.documents.forEach(s => mergedMap.set(s.$id, s));
    classStudents.forEach(s => mergedMap.set(s.$id, s));
    const finalMentees = Array.from(mergedMap.values());

    console.log(`\n=== FINAL MENTEES LIST (${finalMentees.length}) ===`);
    finalMentees.forEach(s => {
      console.log(`- ${s.name} (${s.usn}) - Class: ${s.class_label || s.class_id}`);
    });

    if (finalMentees.length > 0) {
      console.log("\nSUCCESS: Mentees correctly resolved!");
    } else {
      console.log("\nFAILURE: No mentees resolved.");
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

run();
