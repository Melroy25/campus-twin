import dotenv from 'dotenv';
dotenv.config();

import { Client, Users, Query } from 'node-appwrite';

const client = new Client()
  .setEndpoint(process.env.VITE_APPWRITE_ENDPOINT)
  .setProject(process.env.VITE_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const users = new Users(client);

async function resetAdminPassword() {
  try {
    // Find admin user by email
    const email = 'admin@campustwin.edu';
    const res = await users.list([Query.equal('email', email)]);
    
    if (res.total === 0) {
      console.log('Admin user not found!');
      return;
    }

    const adminUser = res.users[0];
    console.log('Found admin:', adminUser.$id, adminUser.email, adminUser.name);

    // Reset password to CampusTwin123
    await users.updatePassword(adminUser.$id, 'CampusTwin123');
    console.log('\n✅ Admin password reset successfully!');
    console.log('---');
    console.log('USN/Username: admin');
    console.log('Role: Admin');
    console.log('New Password: CampusTwin123');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

resetAdminPassword();
