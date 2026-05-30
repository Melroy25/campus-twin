import { Client, Databases } from 'node-appwrite';
import dotenv from 'dotenv';

dotenv.config({ path: 'e:/Projects/Campus Twin/.env' });

const client = new Client()
    .setEndpoint(process.env.VITE_APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1')
    .setProject(process.env.VITE_APPWRITE_PROJECT_ID || '6a084d8900251e5c0f6e')
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const DATABASE_ID = process.env.VITE_APPWRITE_DATABASE_ID || '6a084e9b00061aea385a';

async function addAttribute() {
    try {
        console.log("Adding initial_password attribute to userRoles...");
        const result = await databases.createStringAttribute(
            DATABASE_ID,
            'userRoles',
            'initial_password',
            255,
            false // not required
        );
        console.log("Attribute creation initiated successfully:", result);
    } catch (e) {
        console.error("ERROR:", e.message);
    }
}
addAttribute();
