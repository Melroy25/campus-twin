import { Client, Databases, ID } from 'appwrite';

const client = new Client()
    .setEndpoint('https://nyc.cloud.appwrite.io/v1')
    .setProject('6a084d8900251e5c0f6e');

const databases = new Databases(client);

async function test() {
    try {
        console.log("Testing DB connection...");
        const res = await databases.createDocument(
            '6a084e9b00061aea385a', // VITE_APPWRITE_DATABASE_ID
            'timetable',
            ID.unique(),
            { class_id: 'test', day: 'Monday', subject: 'test', time: 'test' }
        );
        console.log("SUCCESS:", res);
    } catch (e) {
        console.error("ERROR:", e.message, e.code);
    }
}
test();
