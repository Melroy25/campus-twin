import { Client, Account } from 'appwrite';

const client = new Client()
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject('6a084d8900251e5c0f6e');

const account = new Account(client);

async function test() {
    try {
        console.log("Attempting login...");
        const session = await account.createEmailPasswordSession('admin@campustwin.edu', '12345678');
        console.log("SUCCESS!", session);
    } catch (e) {
        console.error("ERROR:", e.message, e.code, e.type);
    }
}
test();
