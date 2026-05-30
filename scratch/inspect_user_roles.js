import { Client, Databases } from 'node-appwrite';
import dotenv from 'dotenv';

// Read .env from the project root
dotenv.config({ path: 'e:/Projects/Campus Twin/.env' });

const client = new Client()
    .setEndpoint(process.env.VITE_APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1')
    .setProject(process.env.VITE_APPWRITE_PROJECT_ID || '6a084d8900251e5c0f6e')
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const DATABASE_ID = process.env.VITE_APPWRITE_DATABASE_ID || '6a084e9b00061aea385a';

async function inspectSchema() {
    try {
        console.log("Fetching userRoles attributes...");
        const response = await databases.listAttributes(DATABASE_ID, 'userRoles');
        console.log("userRoles schema attributes:");
        response.attributes.forEach(attr => {
            console.log(`- ${attr.key}: type=${attr.type}, required=${attr.required}`);
        });

        console.log("\nFetching first few userRoles docs...");
        const rolesRes = await databases.listDocuments(DATABASE_ID, 'userRoles', []);
        if (rolesRes.documents.length > 0) {
            console.log("Sample userRoles Document:", JSON.stringify(rolesRes.documents[0], null, 2));
        } else {
            console.log("No userRoles documents found.");
        }
    } catch (e) {
        console.error("ERROR:", e.message);
    }
}
inspectSchema();
