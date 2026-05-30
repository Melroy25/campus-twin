import { Client, Databases, Query } from 'node-appwrite';

const client = new Client()
    .setEndpoint('https://nyc.cloud.appwrite.io/v1')
    .setProject('6a084d8900251e5c0f6e')
    .setKey('standard_0d4700d805c549e4289f2075a05c0c074d7f6b2d70f6f27a380288366ae70cd28f1a3af9ca000b97617f8aae2b6b32d4910d2ee67c377eb170527e26e5e3cda260bdbf345315935037f10bbfd186e597a1f2d4fc6112c1ac9527f32d906c70bba7d7736dc32da31d44b77810d283f9f36108bfb2f342ca441f85ab2d3b6a50c7');

const databases = new Databases(client);
const DATABASE_ID = '6a084e9b00061aea385a';

const CURRENT_USER_UID = '6a1111fc00357c5d630b'; // Vishwa Roopa's UID

// Helper functions matching database.js
const where = (field, operator, value) => {
  if (operator === '==') return Query.equal(field, value);
  return Query.equal(field, value);
};

const queryDocuments = async (collectionId, queries = []) => {
  const response = await databases.listDocuments(DATABASE_ID, collectionId, [
      ...queries,
      Query.limit(100)
  ]);
  return response.documents.map(doc => ({ ...doc, id: doc.$id }));
};

const getById = async (collectionId, documentId) => {
  try {
    const doc = await databases.getDocument(DATABASE_ID, collectionId, documentId);
    return { ...doc, id: doc.$id };
  } catch (error) {
    return null;
  }
};

const getStudentsByClass = async (classId) => {
  return await queryDocuments('students', [Query.equal('class_id', classId)]);
};

const getAttendanceByStudent = async (studentId) => {
  return await queryDocuments('attendance', [Query.equal('student_id', studentId)]);
};

const getAICTEByStudent = async (studentId) => {
  return await queryDocuments('aictePoints', [Query.equal('student_id', studentId)]);
};

const getAttendanceSummary = (attendanceRecords) => {
  const summary = {};
  attendanceRecords.forEach((r) => {
    if (!summary[r.subject]) {
      summary[r.subject] = { present: 0, total: 0 };
    }
    summary[r.subject].total += 1;
    if (r.status === 'present') summary[r.subject].present += 1;
  });
  return Object.keys(summary).map((sub) => ({
    subject: sub,
    percentage: Math.round((summary[sub].present / summary[sub].total) * 100),
  }));
};

async function run() {
  try {
    console.log("Starting MentorStudents load simulation...");

    // 1. Fetch students who have this mentor assigned directly
    const directStudents = await queryDocuments('students', [where('mentor_id', '==', CURRENT_USER_UID)]);
    console.log(`1. directStudents fetched: ${directStudents.length}`);

    // 2. Fetch classes where this teacher is the mentor
    const mentoredClasses = await queryDocuments('classes', [where('mentor_id', '==', CURRENT_USER_UID)]);
    console.log(`2. mentoredClasses fetched: ${mentoredClasses.length}`);

    // 3. Fetch students belonging to those classes
    const classStudentsPromises = mentoredClasses.map(cls => getStudentsByClass(cls.id));
    const classStudentsResults = await Promise.all(classStudentsPromises);
    const classStudents = classStudentsResults.flat();
    console.log(`3. classStudents fetched: ${classStudents.length}`);

    // 4. Merge lists by unique student ID
    const studentsMap = new Map();
    directStudents.forEach(s => studentsMap.set(s.id, s));
    classStudents.forEach(s => studentsMap.set(s.id, s));
    const students = Array.from(studentsMap.values());
    console.log(`4. Merged students count: ${students.length}`);

    // Fetch distinct class details for these students
    const classIds = [...new Set(students.map(s => s.class_id).filter(Boolean))];
    const classData = await Promise.all(classIds.map(id => getById('classes', id)));
    const classes = classData.filter(Boolean);
    console.log(`5. Fetched classes count: ${classes.length}`);

    const data = {};
    console.log("\nFetching details for each student...");
    await Promise.all(students.map(async (s) => {
      const [attendance, aicte] = await Promise.all([
        getAttendanceByStudent(s.id),
        getAICTEByStudent(s.id),
      ]);
      const summary = getAttendanceSummary(attendance);
      const avgPct = summary.length
        ? Math.round(summary.reduce((sum, r) => sum + r.percentage, 0) / summary.length)
        : null;
      data[s.id] = {
        summary,
        avgPct,
        aicte,
        pendingAICTE: aicte.filter((a) => a.status === 'pending').length,
        approvedAICTE: aicte.filter((a) => a.status === 'approved').length,
        totalAICTEPoints: aicte
          .filter((a) => a.status === 'approved')
          .reduce((sum, a) => sum + (Number(a.points) || 0), 0),
      };
      console.log(`- Student: ${s.name}, Attendance Recs: ${attendance.length}, AICTE Recs: ${aicte.length}`);
    }));

    console.log("\nSimulation finished successfully without errors!");
  } catch (err) {
    console.error("ERROR ENCOUNTERED:", err);
  }
}

run();
