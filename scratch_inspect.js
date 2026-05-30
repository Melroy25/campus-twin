import { Client, Databases } from 'node-appwrite';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client()
    .setEndpoint(process.env.VITE_APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1')
    .setProject(process.env.VITE_APPWRITE_PROJECT_ID || '6a084d8900251e5c0f6e')
    .setKey(process.env.APPWRITE_API_KEY || 'standard_0d4700d805c549e4289f2075a05c0c074d7f6b2d70f6f27a380288366ae70cd28f1a3af9ca000b97617f8aae2b6b32d4910d2ee67c377eb170527e26e5e3cda260bdbf345315935037f10bbfd186e597a1f2d4fc6112c1ac9527f32d906c70bba7d7736dc32da31d44b77810d283f9f36108bfb2f342ca441f85ab2d3b6a50c7');

const databases = new Databases(client);
const DATABASE_ID = process.env.VITE_APPWRITE_DATABASE_ID || '6a084e9b00061aea385a';

async function inspectSchema() {
    try {
        console.log("DATABASE_ID:", DATABASE_ID);
        console.log("Fetching student attributes...");
        const response = await databases.listAttributes(DATABASE_ID, 'students');
        console.log("Student schema attributes:");
        response.attributes.forEach(attr => {
            console.log(`- ${attr.key}: type=${attr.type}, required=${attr.required}`);
        });

        console.log("\nFetching first student doc...");
        const studentsRes = await databases.listDocuments(DATABASE_ID, 'students', []);
        if (studentsRes.documents.length > 0) {
            const doc = studentsRes.documents[0];
            console.log("Sample Student Document keys:", Object.keys(doc));
            console.log("Sample student data (subset):", {
                uid: doc.uid,
                name: doc.name,
                usn: doc.usn,
                class_id: doc.class_id,
                cgpa: doc.cgpa,
                branch_id: doc.branch_id
            });
        } else {
            console.log("No students found.");
        }
    } catch (e) {
        console.error("ERROR:", e.message);
    }
}
inspectSchema();
