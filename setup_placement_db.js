import { Client, Databases, Permission, Role } from 'node-appwrite';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client()
    .setEndpoint('https://nyc.cloud.appwrite.io/v1')
    .setProject('6a084d8900251e5c0f6e')
    .setKey(process.env.APPWRITE_API_KEY || 'standard_0d4700d805c549e4289f2075a05c0c074d7f6b2d70f6f27a380288366ae70cd28f1a3af9ca000b97617f8aae2b6b32d4910d2ee67c377eb170527e26e5e3cda260bdbf345315935037f10bbfd186e597a1f2d4fc6112c1ac9527f32d906c70bba7d7736dc32da31d44b77810d283f9f36108bfb2f342ca441f85ab2d3b6a50c7');

const databases = new Databases(client);
const DATABASE_ID = '6a084e9b00061aea385a';

const schemas = {
  placementUsers: {
    admin_id: 255,
    username: 255,
    password: 255, // SHA-256 hashed
    role: 255      // placement_admin
  },
  placementProfiles: {
    student_uid: 255,
    student_name: 255,
    student_usn: 255,
    branch_id: 255,
    class_id: 255,
    semester: 255,
    cgpa: 255,
    backlogs: 'integer',
    resume_url: 2000,
    resume_status: 255, // pending, approved, rejected, not_submitted
    resume_feedback: 1000,
    placement_status: 255, // eligible, placed, unplaced, ineligible
    placed_company: 255,
    placed_package: 255,
    training_attendance: 255,
    skills: 1000,
    linkedin_url: 1000,
    github_url: 1000
  },
  placementSessions: {
    session_id: 255,
    title: 255,
    company_name: 255,
    date: 255,
    time: 255,
    venue: 255,
    speaker: 255,
    eligible_branches: 1000,
    eligible_semesters: 255,
    cgpa_cutoff: 255,
    description: 2000,
    status: 255, // scheduled, ongoing, completed, cancelled
    attendance_marked: 'boolean'
  },
  placementAttendance: {
    attendance_id: 255,
    session_id: 255,
    student_uid: 255,
    student_name: 255,
    student_usn: 255,
    branch_id: 255,
    status: 255, // present, absent
    marked_at: 255
  },
  placementCompanies: {
    company_id: 255,
    name: 255,
    website: 255,
    logo_url: 2000,
    about: 2000,
    packages_offered: 255,
    eligibility_criteria: 1000,
    roles_offered: 255,
    visit_date: 255,
    status: 255 // upcoming, completed
  },
  placementApplications: {
    application_id: 255,
    company_id: 255,
    student_uid: 255,
    student_name: 255,
    student_usn: 255,
    role: 255,
    status: 255, // applied, shortlisted, selected, rejected
    applied_at: 255
  },
  placementResources: {
    resource_id: 255,
    title: 255,
    category: 255, // Aptitude, Coding, Interview, Resume
    content_url: 2000,
    description: 1000,
    createdAt: 255
  },
  placementAnnouncements: {
    announcement_id: 255,
    title: 255,
    content: 4000,
    target_branches: 255, // comma-separated or all
    target_semesters: 255, // comma-separated or all
    is_important: 'boolean',
    createdAt: 255
  },
  placementPlacedStudents: {
    record_id: 255,
    student_uid: 255,
    student_name: 255,
    student_usn: 255,
    branch: 255,
    company_name: 255,
    package: 255,
    role: 255,
    testimonial: 1000,
    image_url: 2000,
    placed_year: 255,
    createdAt: 255
  }
};

const permissions = [
  Permission.create(Role.any()),
  Permission.read(Role.any()),
  Permission.update(Role.any()),
  Permission.delete(Role.any())
];

async function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function run() {
  console.log("Starting Placement DB Schema creation...");

  for (const [colName, attributes] of Object.entries(schemas)) {
    console.log(`Processing collection: ${colName}`);
    let collectionExists = false;
    try {
      await databases.getCollection(DATABASE_ID, colName);
      collectionExists = true;
    } catch (e) {
      if (e.code !== 404) console.log(e.message);
    }

    try {
      if (!collectionExists) {
        await databases.createCollection(DATABASE_ID, colName, colName, permissions);
        console.log(` Created collection ${colName}`);
        await delay(500);
      } else {
        console.log(` Collection ${colName} already exists, updating permissions...`);
        await databases.updateCollection(DATABASE_ID, colName, colName, permissions);
      }

      // Add attributes
      for (const [attrName, attrType] of Object.entries(attributes)) {
        try {
          if (attrType === 'integer') {
            await databases.createIntegerAttribute(DATABASE_ID, colName, attrName, false);
          } else if (attrType === 'boolean') {
            await databases.createBooleanAttribute(DATABASE_ID, colName, attrName, false);
          } else {
            await databases.createStringAttribute(DATABASE_ID, colName, attrName, attrType, false);
          }
          console.log(`  Added attribute: ${attrName} to ${colName}`);
          await delay(200); 
        } catch (err) {
          if (err.code !== 409) { 
            console.error(`  Error adding attribute ${attrName}:`, err.message);
          }
        }
      }
    } catch (err) {
      console.error(`Error processing collection ${colName}:`, err.message);
    }
  }

  // Seed default admin
  try {
    console.log("Seeding default placement admin account...");
    const hashed = crypto.createHash('sha256').update('placement').digest('hex');
    const adminDocs = await databases.listDocuments(DATABASE_ID, 'placementUsers');
    const exists = adminDocs.documents.some(doc => doc.username === 'placement_admin');
    
    if (!exists) {
      await databases.createDocument(DATABASE_ID, 'placementUsers', 'placement_admin', {
        admin_id: 'placement_admin',
        username: 'placement_admin',
        password: hashed,
        role: 'placement_admin'
      });
      console.log(" Successfully seeded placement_admin / placement");
    } else {
      console.log(" placement_admin already exists");
    }
  } catch (err) {
    console.error("Error seeding default admin:", err.message);
  }

  console.log("Placement DB Schema Setup Complete!");
}

run();
