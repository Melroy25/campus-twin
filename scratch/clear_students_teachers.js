import { Client, Databases } from 'node-appwrite';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const ENDPOINT = process.env.VITE_APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1';
const PROJECT_ID = process.env.VITE_APPWRITE_PROJECT_ID || '6a084d8900251e5c0f6e';
const DATABASE_ID = process.env.VITE_APPWRITE_DATABASE_ID || '6a084e9b00061aea385a';
const API_KEY = process.env.APPWRITE_API_KEY || 'standard_c7dff7481bb2f7982c52d1ddb8b45de44d5ee3eae0b79b0733544b309e48835263ad18f68a8dede36f3708947185958e019a0b6854d4945b801d99350fa65d75a2a7c3cf0667530ac2bbfafb822c87dbd350b738d8a1975c993e7a5f42672a91bd254e5a3ff82ae2cc6e4009707d99ebb7c6e9bc5b99818d82648421af2c1e50';

const client = new Client()
  .setEndpoint(ENDPOINT)
  .setProject(PROJECT_ID)
  .setKey(API_KEY);

const databases = new Databases(client);

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function run() {
  console.log('--- STARTING CLEANING PROCESS ---');

  // 1. Delete Appwrite Students
  try {
    console.log('Fetching students from Appwrite...');
    const studentsRes = await databases.listDocuments(DATABASE_ID, 'students');
    console.log(`Found ${studentsRes.documents.length} student documents.`);
    for (const doc of studentsRes.documents) {
      await databases.deleteDocument(DATABASE_ID, 'students', doc.$id);
      console.log(`Deleted student document: ${doc.$id} (${doc.name})`);
      await delay(100);
    }
  } catch (err) {
    console.error('Error deleting Appwrite students:', err.message);
  }

  // 2. Delete Appwrite Teachers
  try {
    console.log('Fetching teachers from Appwrite...');
    const teachersRes = await databases.listDocuments(DATABASE_ID, 'teachers');
    console.log(`Found ${teachersRes.documents.length} teacher documents.`);
    for (const doc of teachersRes.documents) {
      await databases.deleteDocument(DATABASE_ID, 'teachers', doc.$id);
      console.log(`Deleted teacher document: ${doc.$id} (${doc.name})`);
      await delay(100);
    }
  } catch (err) {
    console.error('Error deleting Appwrite teachers:', err.message);
  }

  // 3. Delete Appwrite userRoles (only where role is 'student' or 'teacher' or 'mentor')
  try {
    console.log('Fetching userRoles from Appwrite...');
    const userRolesRes = await databases.listDocuments(DATABASE_ID, 'userRoles');
    console.log(`Found ${userRolesRes.documents.length} user role documents.`);
    for (const doc of userRolesRes.documents) {
      if (['student', 'teacher', 'mentor'].includes(doc.role)) {
        await databases.deleteDocument(DATABASE_ID, 'userRoles', doc.$id);
        console.log(`Deleted user role document: ${doc.$id} (${doc.name} - ${doc.role})`);
        await delay(100);
      }
    }
  } catch (err) {
    console.error('Error deleting userRoles:', err.message);
  }

  // 4. Delete Supabase student_profiles
  try {
    console.log('Deleting student profiles from Supabase...');
    const { data, error } = await supabase
      .from('student_profiles')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete everything
    if (error) throw error;
    console.log('Successfully cleared Supabase student_profiles table!');
  } catch (err) {
    console.error('Error deleting Supabase student_profiles:', err.message);
  }

  console.log('--- CLEANING PROCESS COMPLETED ---');
}

run();
