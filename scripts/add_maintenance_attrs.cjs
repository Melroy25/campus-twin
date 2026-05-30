// Script to add maintenance_students and maintenance_teachers boolean attributes
// to the branches collection in Appwrite

const { Client, Databases } = require('node-appwrite');

const client = new Client();
client
  .setEndpoint('https://nyc.cloud.appwrite.io/v1')
  .setProject('6a084d8900251e5c0f6e')
  .setKey(process.env.APPWRITE_API_KEY || 'standard_c7dff7481bb2f7982c52d1ddb8b45de44d5ee3eae0b79b0733544b309e48835263ad18f68a8dede36f3708947185958e019a0b6854d4945b801d99350fa65d75a2a7c3cf0667530ac2bbfafb822c87dbd350b738d8a1975c993e7a5f42672a91bd254e5a3ff82ae2cc6e4009707d99ebb7c6e9bc5b99818d82648421af2c1e50');

const databases = new Databases(client);
const DATABASE_ID = '6a084e9b00061aea385a';
const COLLECTION_ID = 'branches';

async function addAttributes() {
  try {
    console.log('Adding maintenance_students boolean attribute...');
    await databases.createBooleanAttribute(
      DATABASE_ID,
      COLLECTION_ID,
      'maintenance_students',
      false, // not required
      false  // default value
    );
    console.log('✅ maintenance_students attribute created');
  } catch (err) {
    if (err.message?.includes('already exists') || err.code === 409) {
      console.log('⚠️ maintenance_students already exists, skipping');
    } else {
      console.error('❌ Failed to create maintenance_students:', err.message);
    }
  }

  try {
    console.log('Adding maintenance_teachers boolean attribute...');
    await databases.createBooleanAttribute(
      DATABASE_ID,
      COLLECTION_ID,
      'maintenance_teachers',
      false, // not required
      false  // default value
    );
    console.log('✅ maintenance_teachers attribute created');
  } catch (err) {
    if (err.message?.includes('already exists') || err.code === 409) {
      console.log('⚠️ maintenance_teachers already exists, skipping');
    } else {
      console.error('❌ Failed to create maintenance_teachers:', err.message);
    }
  }

  console.log('\nDone! Attributes should be available shortly (Appwrite processes them async).');
}

addAttributes();
