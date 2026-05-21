import { databases, DATABASE_ID, client } from './config';
import { ID, Query } from 'appwrite';

/**
 * Backward compatibility helper for Firebase's where clause.
 * Translates where('field', '==', 'value') into Query.equal('field', 'value')
 */
export const where = (field, operator, value) => {
  if (operator === '==') return Query.equal(field, value);
  if (operator === '!=') return Query.notEqual(field, value);
  if (operator === '>') return Query.greaterThan(field, value);
  if (operator === '>=') return Query.greaterThanEqual(field, value);
  if (operator === '<') return Query.lessThan(field, value);
  if (operator === '<=') return Query.lessThanEqual(field, value);
  if (operator === 'in') return Query.equal(field, value);
  if (operator === 'array-contains') return Query.search(field, value); // Approximate
  return Query.equal(field, value);
};


/**
 * Fetch a single document by its internal ID
 */
export const getById = async (collectionId, documentId) => {
  try {
    const doc = await databases.getDocument(DATABASE_ID, collectionId, documentId);
    const result = { ...doc, id: doc.$id };
    if (collectionId === 'teachers' && typeof result.class_assignments === 'string') {
      try {
        result.class_assignments = JSON.parse(result.class_assignments);
      } catch (e) {
        result.class_assignments = [];
      }
    }
    return result;
  } catch (error) {
    console.warn(`Doc not found/error in ${collectionId}/${documentId}`, error);
    return null;
  }
};

/**
 * Fetch all documents from a collection without filters
 */
export const getAll = async (collectionId) => {
  try {
    const response = await databases.listDocuments(DATABASE_ID, collectionId, [
        Query.limit(100)
    ]);
    return response.documents.map(doc => {
      const result = { ...doc, id: doc.$id };
      if (collectionId === 'teachers' && typeof result.class_assignments === 'string') {
        try {
          result.class_assignments = JSON.parse(result.class_assignments);
        } catch (e) {
          result.class_assignments = [];
        }
      }
      return result;
    });
  } catch (error) {
    console.error(`Error fetching all from ${collectionId}:`, error);
    return [];
  }
};

/**
 * Perform a query using standard equality fields.
 * Appwrite queries use formatted strings, e.g. Query.equal('field', ['value'])
 */
export const queryDocuments = async (collectionId, queries = []) => {
  try {
    // queries argument expects Appwrite Query objects 
    // Example: [Query.equal('role', 'student')]
    const response = await databases.listDocuments(DATABASE_ID, collectionId, [
        ...queries,
        Query.limit(100)
    ]);
    return response.documents.map(doc => {
      const result = { ...doc, id: doc.$id };
      if (collectionId === 'teachers' && typeof result.class_assignments === 'string') {
        try {
          result.class_assignments = JSON.parse(result.class_assignments);
        } catch (e) {
          result.class_assignments = [];
        }
      }
      return result;
    });
  } catch (error) {
    console.error(`Error querying ${collectionId}:`, error);
    return [];
  }
};

/**
 * Add a new document (auto-generated ID)
 */
export const addDocument = async (collectionId, data) => {
  try {
    const doc = await databases.createDocument(DATABASE_ID, collectionId, ID.unique(), data);
    return { ...doc, id: doc.$id };
  } catch (error) {
    console.error(`Error adding to ${collectionId}:`, error);
    throw error;
  }
};

/**
 * Add document with custom ID 
 * (Helpful for users table where the ID could be the Appwrite Auth userId)
 */
export const addDocumentWithId = async (collectionId, documentId, data) => {
  try {
    const doc = await databases.createDocument(DATABASE_ID, collectionId, documentId, data);
    return { ...doc, id: doc.$id };
  } catch (error) {
    console.error(`Error adding to ${collectionId} with ID:`, error);
    throw error;
  }
};

/**
 * Update an existing document
 */
export const updateDocument = async (collectionId, documentId, data) => {
  try {
    await databases.updateDocument(DATABASE_ID, collectionId, documentId, data);
  } catch (error) {
    console.error(`Error updating ${collectionId}/${documentId}:`, error);
    throw error;
  }
};

/**
 * Delete a document
 */
export const deleteDocument = async (collectionId, documentId) => {
  try {
    await databases.deleteDocument(DATABASE_ID, collectionId, documentId);
  } catch (error) {
    console.error(`Error deleting ${collectionId}/${documentId}:`, error);
    throw error;
  }
};

/**
 * Firestore Helper Emulators for Backward Compatibility with our code
 */

// User / Auth mapping
export const getUserProfile = async (uid) => {
  // 1. Try to get role from userRoles first
  try {
    const rolesDocs = await queryDocuments('userRoles', [Query.equal('uid', uid)]);
    if (rolesDocs.length > 0) {
      const role = rolesDocs[0].role;
      const collection = role === 'student' ? 'students' : (role === 'teacher' || role === 'mentor') ? 'teachers' : 'admins';
      const profiles = await queryDocuments(collection, [Query.equal('uid', uid)]);
      if (profiles.length > 0) {
        const profile = { ...profiles[0], id: profiles[0].$id, role };
        if (profile.class_assignments && typeof profile.class_assignments === 'string') {
          try {
            profile.class_assignments = JSON.parse(profile.class_assignments);
          } catch (e) {
            profile.class_assignments = [];
          }
        }
        return profile;
      }
    }
  } catch (err) {
    console.warn("Failed to query userRoles collection:", err);
  }

  // 2. Fallback to trying all roles tables (backward compatibility)
  for (const table of ['students', 'teachers', 'admins']) {
    try {
      const users = await queryDocuments(table, [Query.equal('uid', uid)]);
      if (users.length > 0) {
        const profile = { ...users[0], id: users[0].$id, role: table.slice(0, -1) };
        if (profile.class_assignments && typeof profile.class_assignments === 'string') {
          try {
            profile.class_assignments = JSON.parse(profile.class_assignments);
          } catch (e) {
            profile.class_assignments = [];
          }
        }
        return profile;
      }
    } catch {}
  }
  return null;
};

// Students & Classes
export const getStudentsByClass = async (classId) => {
  return await queryDocuments('students', [Query.equal('class_id', classId)]);
};
export const listenClasses = (callback) => {
  // Initial fetch
  getAll('classes').then(callback);
  
  // Realtime subscription
  return client.subscribe(`databases.${DATABASE_ID}.collections.classes.documents`, (response) => {
    // Re-fetch all on change for simplicity, or manage state delta
    getAll('classes').then(callback);
  });
};

// Attendance
export const getAttendanceByStudent = async (studentId) => {
  return await queryDocuments('attendance', [Query.equal('student_id', studentId)]);
};
export const getAttendanceSummary = (attendanceRecords) => {
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

// AICTE
export const getAICTEByStudent = async (studentId) => {
  return await queryDocuments('aictePoints', [Query.equal('student_id', studentId)]);
};
export const getAICTEByMentor = async (mentorId) => {
  return await queryDocuments('aictePoints', [Query.equal('mentor_id', mentorId)]);
};

// Leave
export const getLeaveRequestsByStudent = async (studentId) => {
  return await queryDocuments('leaveRequests', [Query.equal('student_id', studentId)]);
};
export const getLeaveRequestsByTeacher = async (classIds) => {
  if (!classIds || classIds.length === 0) return [];
  // For simplicity since Appwrite queries don't easily do "IN" array of classIds for nested lookups,
  // we do a generic fetch and filter for prototype
  const allReqs = await getAll('leaveRequests');
  const allStudents = await getAll('students');
  const studentMap = {};
  allStudents.forEach(s => { studentMap[s.uid] = s; });

  const teacherIds = classIds; // string class IDs
  return allReqs.filter(r => {
    const st = studentMap[r.student_id];
    return st && teacherIds.includes(st.class_id);
  });
};

// Complaints
export const addComplaint = async (data) => {
  return await addDocument('complaints', { ...data, createdAt: new Date().toISOString(), status: 'open' });
};
export const getMyComplaints = async (uid) => {
  return await queryDocuments('complaints', [Query.equal('user_id', uid)]);
};
export const listenComplaints = (callback) => {
  getAll('complaints').then(callback);
  return client.subscribe(`databases.${DATABASE_ID}.collections.complaints.documents`, () => {
    getAll('complaints').then(callback);
  });
};

// Events
export const listenEvents = (callback) => {
  getAll('events').then(callback);
  return client.subscribe(`databases.${DATABASE_ID}.collections.events.documents`, () => getAll('events').then(callback));
};

// Timetable
export const getTodayTimetable = async (classId, day) => queryDocuments('timetable', [Query.equal('class_id', classId), Query.equal('day', day)]);
export const getTimetableByClass = async (classId) => queryDocuments('timetable', [Query.equal('class_id', classId)]);
export const getCommentsByTimetable = async (ttId) => queryDocuments('comments', [Query.equal('timetable_id', ttId)]);
export const getPendingComments = async () => queryDocuments('comments', [Query.equal('status', 'pending')]);

// Marks
export const getMarksByStudent = async (studentId) => queryDocuments('marks', [Query.equal('student_id', studentId)]);
export const getMarksCardsByStudent = async (studentId) => queryDocuments('marksCards', [Query.equal('student_id', studentId)]);

// Complaints
export const resolveComplaint = async (id) => updateDocument('complaints', id, { status: 'resolved' });
export const deleteComplaint = async (id) => deleteDocument('complaints', id);

// Notifications & ChangeLog
export const listenNotifications = (userId, cb) => {
  queryDocuments('notifications', [Query.equal('user_id', userId)]).then(cb);
  return client.subscribe(`databases.${DATABASE_ID}.collections.notifications.documents`, () => queryDocuments('notifications', [Query.equal('user_id', userId)]).then(cb));
};
export const markNotificationRead = async (id) => updateDocument('notifications', id, { read_status: true });

export const addNotification = async (userIdOrData, message) => {
  if (typeof userIdOrData === 'object' && userIdOrData !== null) {
    return await addDocument('notifications', { ...userIdOrData, read_status: false, createdAt: new Date().toISOString() });
  } else {
    return await addDocument('notifications', { user_id: userIdOrData, message, read_status: false, createdAt: new Date().toISOString() });
  }
};

export const addChangeLog = async (timetableIdOrData, action, details, changedBy) => {
  if (typeof timetableIdOrData === 'object' && timetableIdOrData !== null) {
    return await addDocument('changelogs', { ...timetableIdOrData, createdAt: new Date().toISOString() });
  } else {
    return await addDocument('changelogs', {
      timetable_id: timetableIdOrData,
      action,
      details,
      changed_by: changedBy,
      createdAt: new Date().toISOString()
    });
  }
};

// Event Registrations
export const registerForEvent = async (eventId, studentId, studentName, studentUsn) => {
  return await addDocument('event_registrations', {
    event_id: eventId,
    student_id: studentId,
    student_name: studentName,
    student_usn: studentUsn,
    registeredAt: new Date().toISOString()
  });
};

export const unregisterFromEvent = async (eventIdOrRegistrationId, studentId) => {
  if (studentId) {
    const regs = await queryDocuments('event_registrations', [
      Query.equal('event_id', eventIdOrRegistrationId),
      Query.equal('student_id', studentId)
    ]);
    if (regs.length > 0) {
      for (const reg of regs) {
        await deleteDocument('event_registrations', reg.$id);
      }
    }
  } else {
    return await deleteDocument('event_registrations', eventIdOrRegistrationId);
  }
};

export const getEventRegistrations = async (eventId) => {
  return await queryDocuments('event_registrations', [Query.equal('event_id', eventId)]);
};

export const getMyEventRegistrations = async (studentId) => {
  return await queryDocuments('event_registrations', [Query.equal('student_id', studentId)]);
};

export const getEventRegistrationsByStudent = getMyEventRegistrations;


// Classes
export const getClasses = async () => getAll('classes');
export const addClass = async (data) => addDocument('classes', data);
export const deleteClass = async (id) => deleteDocument('classes', id);

// Leave
export const getPendingLeaveRequests = async () => queryDocuments('leaveRequests', [Query.equal('status', 'pending')]);


