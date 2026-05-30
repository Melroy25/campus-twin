const { Client, Databases, Permission, Role } = require('node-appwrite');

const client = new Client();
client
  .setEndpoint('https://nyc.cloud.appwrite.io/v1')
  .setProject('6a084d8900251e5c0f6e')
  .setKey(process.env.APPWRITE_API_KEY || 'standard_c7dff7481bb2f7982c52d1ddb8b45de44d5ee3eae0b79b0733544b309e48835263ad18f68a8dede36f3708947185958e019a0b6854d4945b801d99350fa65d75a2a7c3cf0667530ac2bbfafb822c87dbd350b738d8a1975c993e7a5f42672a91bd254e5a3ff82ae2cc6e4009707d99ebb7c6e9bc5b99818d82648421af2c1e50');

const databases = new Databases(client);
const DATABASE_ID = '6a084e9b00061aea385a';

async function fixPermissions() {
  try {
    // Get the collection to check Document Security
    const collection = await databases.getCollection(DATABASE_ID, 'branches');
    console.log('Collection Document Security:', collection.documentSecurity);
    
    // Set collection permissions to allow anyone to read
    await databases.updateCollection(
      DATABASE_ID, 
      'branches', 
      'branches', 
      [
        Permission.create(Role.any()),
        Permission.read(Role.any()),
        Permission.update(Role.any()),
        Permission.delete(Role.any())
      ],
      false // Document Security = false
    );
    console.log('Collection permissions updated and Document Security disabled.');

    // Update existing documents to remove strict document-level permissions
    const branches = await databases.listDocuments(DATABASE_ID, 'branches');
    for (const doc of branches.documents) {
      await databases.updateDocument(
        DATABASE_ID,
        'branches',
        doc.$id,
        {
          // Add a dummy update to force permission rewrite if needed, 
          // or explicitly pass permissions array.
        },
        [
          Permission.read(Role.any()),
          Permission.update(Role.any()),
          Permission.delete(Role.any())
        ]
      );
      console.log(`Updated permissions for branch: ${doc.name}`);
    }

  } catch (err) {
    console.error('Error:', err);
  }
}

fixPermissions();
