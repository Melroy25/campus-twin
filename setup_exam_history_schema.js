import { Client, Databases, Permission, Role } from 'node-appwrite';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client()
    .setEndpoint(process.env.VITE_APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1')
    .setProject(process.env.VITE_APPWRITE_PROJECT_ID || '6a084d8900251e5c0f6e')
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const DATABASE_ID = process.env.VITE_APPWRITE_DATABASE_ID || '6a084e9b00061aea385a';
const COLLECTION_ID = 'examHistory';

async function delay(ms) {
    return new Promise(res => setTimeout(res, ms));
}

async function run() {
    console.log("Setting up Appwrite schema for examHistory...");
    
    // 1. Create Collection
    let exists = false;
    try {
        await databases.getCollection(DATABASE_ID, COLLECTION_ID);
        exists = true;
        console.log("Collection 'examHistory' already exists.");
    } catch (e) {
        if (e.code !== 404) {
            console.error("Error fetching collection:", e.message);
            return;
        }
    }

    if (!exists) {
        try {
            console.log("Creating collection 'examHistory'...");
            const permissions = [
                Permission.read(Role.any()),
                Permission.create(Role.any()),
                Permission.update(Role.any()),
                Permission.delete(Role.any())
            ];
            await databases.createCollection(DATABASE_ID, COLLECTION_ID, 'examHistory', permissions);
            console.log("Collection 'examHistory' created successfully!");
            await delay(1000);
        } catch (e) {
            console.error("Failed to create collection:", e.message);
            return;
        }
    }

    // 2. Create Attributes
    const attributes = [
        { key: 'student_id', type: 'string', size: 255, required: true },
        { key: 'semester', type: 'integer', required: true },
        { key: 'academic_year', type: 'string', size: 100, required: true },
        { key: 'sgpa', type: 'float', required: true },
        { key: 'credits_registered', type: 'integer', required: true },
        { key: 'credits_earned', type: 'integer', required: true },
        { key: 'semester_status', type: 'string', size: 100, required: true },
        { key: 'createdAt', type: 'string', size: 255, required: false }
    ];

    for (const attr of attributes) {
        try {
            console.log(`Creating attribute '${attr.key}' (${attr.type})...`);
            if (attr.type === 'string') {
                await databases.createStringAttribute(DATABASE_ID, COLLECTION_ID, attr.key, attr.size, attr.required);
            } else if (attr.type === 'integer') {
                await databases.createIntegerAttribute(DATABASE_ID, COLLECTION_ID, attr.key, attr.required);
            } else if (attr.type === 'float') {
                await databases.createFloatAttribute(DATABASE_ID, COLLECTION_ID, attr.key, attr.required);
            }
            console.log(`Attribute '${attr.key}' created!`);
            await delay(500);
        } catch (e) {
            if (e.code === 409) {
                console.log(`Attribute '${attr.key}' already exists.`);
            } else {
                console.error(`Error creating attribute '${attr.key}':`, e.message);
            }
        }
    }

    console.log("Schema setup complete for examHistory!");
}

run();
