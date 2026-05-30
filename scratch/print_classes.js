import { Client, Databases } from 'node-appwrite';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client()
    .setEndpoint(process.env.VITE_APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1')
    .setProject(process.env.VITE_APPWRITE_PROJECT_ID || '6a084d8900251e5c0f6e')
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const DATABASE_ID = process.env.VITE_APPWRITE_DATABASE_ID || '6a084e9b00061aea385a';

async function run() {
  try {
    console.log("Fetching classes...");
    const classes = await databases.listDocuments(DATABASE_ID, 'classes');
    console.log("Total classes:", classes.total);
    for (const doc of classes.documents) {
      console.log("Class Document:", {
        id: doc.$id,
        class_id: doc.class_id,
        name: doc.name,
        semester: doc.semester,
        advisor_id: doc.advisor_id,
        subject_ids: doc.subject_ids
      });
    }

    console.log("\nFetching subjects...");
    const subjects = await databases.listDocuments(DATABASE_ID, 'subjects');
    console.log("Total subjects:", subjects.total);
    for (const doc of subjects.documents) {
      console.log("Subject Document:", {
        id: doc.$id,
        courseCode: doc.courseCode,
        courseName: doc.courseName,
        branch_id: doc.branch_id
      });
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
