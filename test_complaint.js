import { Client, Databases, ID } from 'appwrite';

const client = new Client()
    .setEndpoint('https://nyc.cloud.appwrite.io/v1')
    .setProject('6a084d8900251e5c0f6e');

const databases = new Databases(client);

async function test() {
    try {
        console.log("Testing complaints insertion...");
        const res = await databases.createDocument(
            '6a084e9b00061aea385a', // VITE_APPWRITE_DATABASE_ID
            'complaints',
            ID.unique(),
            {
                student_id: 'test_student',
                category: 'test_category',
                description: 'test_desc',
                photos: [],
                status: 'pending'
            }
        );
        console.log("SUCCESS:", res);
    } catch (e) {
        console.error("ERROR:", e.message, e.code);
    }
}
test();
