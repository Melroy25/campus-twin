import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.APPWRITE_API_KEY;
const endpoint = process.env.VITE_APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1';
const projectId = process.env.VITE_APPWRITE_PROJECT_ID || '6a084d8900251e5c0f6e';
const databaseId = process.env.VITE_APPWRITE_DATABASE_ID || '6a084e9b00061aea385a';

async function runTest() {
  const usn = '4SO24CS128';
  const role = 'student';

  const usnVariants = [usn, usn.toUpperCase(), usn.toLowerCase()];
  const uniqueUsnVariants = [...new Set(usnVariants)];
  const roleVariants = [role];

  // Try formatting usnQuery and roleQuery
  const usnQuery = `equal("usn", ${JSON.stringify(uniqueUsnVariants)})`;
  const roleQuery = `equal("role", ${JSON.stringify(roleVariants)})`;

  console.log('Query usnQuery:', usnQuery);
  console.log('Query roleQuery:', roleQuery);

  // Attempt 1: Using queries[0] and queries[1]
  try {
    const url1 = `${endpoint}/databases/${databaseId}/collections/userRoles/documents?queries[0]=${encodeURIComponent(usnQuery)}&queries[1]=${encodeURIComponent(roleQuery)}`;
    console.log('Attempt 1 URL:', url1);
    const res1 = await fetch(url1, {
      method: 'GET',
      headers: {
        'X-Appwrite-Project': projectId,
        'X-Appwrite-Key': apiKey
      }
    });
    const text1 = await res1.text();
    console.log('Attempt 1 Status:', res1.status);
    console.log('Attempt 1 Body:', text1);
  } catch (err) {
    console.error('Attempt 1 error:', err);
  }

  // Attempt 2: Using queries[] and queries[]
  try {
    const url2 = `${endpoint}/databases/${databaseId}/collections/userRoles/documents?queries[]=${encodeURIComponent(usnQuery)}&queries[]=${encodeURIComponent(roleQuery)}`;
    console.log('Attempt 2 URL:', url2);
    const res2 = await fetch(url2, {
      method: 'GET',
      headers: {
        'X-Appwrite-Project': projectId,
        'X-Appwrite-Key': apiKey
      }
    });
    const text2 = await res2.text();
    console.log('Attempt 2 Status:', res2.status);
    console.log('Attempt 2 Body:', text2);
  } catch (err) {
    console.error('Attempt 2 error:', err);
  }

  // Attempt 3: Using the node-appwrite SDK
  try {
    const { Client, Databases, Query } = await import('node-appwrite');
    const client = new Client()
      .setEndpoint(endpoint)
      .setProject(projectId)
      .setKey(apiKey);
    
    const databases = new Databases(client);
    const res3 = await databases.listDocuments(databaseId, 'userRoles', [
      Query.equal('usn', uniqueUsnVariants),
      Query.equal('role', roleVariants)
    ]);
    console.log('Attempt 3 (SDK) Success! Total documents:', res3.total);
    console.log('First document:', res3.documents[0]);
  } catch (err) {
    console.error('Attempt 3 (SDK) error:', err);
  }
}

runTest();
