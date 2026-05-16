import { Client, Account, Databases, Storage } from 'appwrite';

// Get these from Appwrite Console -> Settings
export const PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID || 'your-project-id';
export const ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';

// We need Database ID and Bucket IDs
export const DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID || 'campus-twin-db';
export const BUCKET_ID = import.meta.env.VITE_APPWRITE_BUCKET_ID || 'campus-twin-storage';

const client = new Client();
client.setEndpoint(ENDPOINT).setProject(PROJECT_ID);

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
export { client };
