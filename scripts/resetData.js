import { clearCollection } from '../src/appwrite/database.js';

async function reset() {
  console.log('Starting reset of student and teacher data...');
  try {
    await clearCollection('students');
    await clearCollection('teachers');
    console.log('Reset complete.');
  } catch (e) {
    console.error('Error during reset:', e);
  }
}

reset();
