const { Client, Databases } = require('node-appwrite');

const client = new Client();
client
  .setEndpoint('https://nyc.cloud.appwrite.io/v1')
  .setProject('6a084d8900251e5c0f6e')
  .setKey('standard_c7dff7481bb2f7982c52d1ddb8b45de44d5ee3eae0b79b0733544b309e48835263ad18f68a8dede36f3708947185958e019a0b6854d4945b801d99350fa65d75a2a7c3cf0667530ac2bbfafb822c87dbd350b738d8a1975c993e7a5f42672a91bd254e5a3ff82ae2cc6e4009707d99ebb7c6e9bc5b99818d82648421af2c1e50');

const databases = new Databases(client);
const DATABASE_ID = '6a084e9b00061aea385a';

async function addAttributes() {
  try {
    console.log("Adding gender to students...");
    await databases.createStringAttribute(DATABASE_ID, 'students', 'gender', 255, false);
    await new Promise(r => setTimeout(r, 1000));
    
    console.log("Adding hostel_type to students...");
    await databases.createStringAttribute(DATABASE_ID, 'students', 'hostel_type', 255, false);
    
    console.log("Attributes added successfully!");
  } catch (err) {
    console.error('Error:', err);
  }
}

addAttributes();
