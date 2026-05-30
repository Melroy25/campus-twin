import { Client, Databases, ID } from 'node-appwrite';

const client = new Client()
    .setEndpoint('https://nyc.cloud.appwrite.io/v1')
    .setProject('6a084d8900251e5c0f6e')
    .setKey('standard_0d4700d805c549e4289f2075a05c0c074d7f6b2d70f6f27a380288366ae70cd28f1a3af9ca000b97617f8aae2b6b32d4910d2ee67c377eb170527e26e5e3cda260bdbf345315935037f10bbfd186e597a1f2d4fc6112c1ac9527f32d906c70bba7d7736dc32da31d44b77810d283f9f36108bfb2f342ca441f85ab2d3b6a50c7');

const databases = new Databases(client);
const DATABASE_ID = '6a084e9b00061aea385a';

async function run() {
    try {
        const uid = ID.unique();
        const profileData = {
          name: "Test Teacher",
          role: "teacher",
          branch_id: "CSE",
          department: "CSE",
          class_assignments: []
        };
        const usn = "4SO24ME001";
        const email = "test@test.com";
        const now = new Date().toISOString();

        const docData = {
          ...profileData,
          usn,
          email,
          uid,
          createdAt: now,
        };

        delete docData.personalEmail;
        delete docData.isHostelite;

        if (profileData.role !== 'admin') {
          delete docData.role;
        }

        if (profileData.role === 'teacher' || profileData.role === 'mentor') {
          delete docData.usn;
          delete docData.branch_id;
        }

        delete docData.class_assignments;
        if (profileData.role === 'teacher' || profileData.role === 'mentor') {
          docData.class_assignments = JSON.stringify(profileData.class_assignments || []);
        }

        console.log("docData for teachers:", docData);
        await databases.createDocument(DATABASE_ID, 'teachers', uid, docData);
        console.log("Inserted into teachers!");

        const userRolesData = {
          name: profileData.name || usn,
          role: profileData.role,
          usn,
          uid,
          createdAt: now,
          branch_id: profileData.branch_id || '',
          is_super_admin: !!profileData.is_super_admin,
        };
        console.log("userRolesData:", userRolesData);
        await databases.createDocument(DATABASE_ID, 'userRoles', uid, userRolesData);
        console.log("Inserted into userRoles!");
    } catch (e) {
        console.error("Appwrite error:", e.message);
    }
}
run();
