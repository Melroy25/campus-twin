import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.APPWRITE_API_KEY;
const endpoint = process.env.VITE_APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1';
const projectId = process.env.VITE_APPWRITE_PROJECT_ID || '6a084d8900251e5c0f6e';
const databaseId = process.env.VITE_APPWRITE_DATABASE_ID || '6a084e9b00061aea385a';

async function listAdmins() {
  try {
    const { Client, Databases, Query } = await import('node-appwrite');
    const client = new Client()
      .setEndpoint(endpoint)
      .setProject(projectId)
      .setKey(apiKey);
    
    const databases = new Databases(client);

    console.log('--- USER ROLES (ADMINS) ---');
    const rolesRes = await databases.listDocuments(databaseId, 'userRoles', [
      Query.equal('role', 'admin')
    ]);
    rolesRes.documents.forEach(doc => {
      console.log(`USN/Username: ${doc.usn}, UID: ${doc.uid}, Name: ${doc.name}, Phone: ${doc.phone}, Must Change Pwd: ${doc.must_change_password}`);
    });

    console.log('\n--- ADMINS DETAIL COLLECTION ---');
    const adminsRes = await databases.listDocuments(databaseId, 'admins');
    adminsRes.documents.forEach(doc => {
      console.log(`UID: ${doc.uid}, Name: ${doc.name}, USN: ${doc.usn}, Super Admin: ${doc.is_super_admin}`);
    });

  } catch (err) {
    console.error('Error listing admins:', err);
  }
}

listAdmins();
