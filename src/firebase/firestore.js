import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db, firebaseConfig } from './config';

const isMock = firebaseConfig.apiKey === 'YOUR_API_KEY';

// ─── Generic Helpers ───────────────────────────────────────────────────────────

export const getAll = async (collectionName) => {
  if (isMock) return [];
  const snapshot = await getDocs(collection(db, collectionName));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getById = async (collectionName, id) => {
  if (isMock) return null;
  const snap = await getDoc(doc(db, collectionName, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const addDocument = async (collectionName, data) => {
  if (isMock) return { id: 'mock-' + Date.now() };
  return await addDoc(collection(db, collectionName), {
    ...data,
    createdAt: serverTimestamp(),
  });
};

export const setDocument = async (collectionName, id, data) => {
  if (isMock) return;
  return await setDoc(doc(db, collectionName, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

export const updateDocument = async (collectionName, id, data) => {
  if (isMock) return;
  return await updateDoc(doc(db, collectionName, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

export const deleteDocument = async (collectionName, id) => {
  if (isMock) return;
  return await deleteDoc(doc(db, collectionName, id));
};

export const queryDocuments = async (collectionName, ...constraints) => {
  if (isMock) return [];
  const q = query(collection(db, collectionName), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// ─── Real-time Listeners ───────────────────────────────────────────────────────

export const listenCollection = (collectionName, callback, ...constraints) => {
  if (isMock) {
    callback([]);
    return () => {};
  }
  const q = constraints.length
    ? query(collection(db, collectionName), ...constraints)
    : collection(db, collectionName);
  return onSnapshot(q, (snapshot) => {
    const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(docs);
  });
};

// ─── Specific Collection Helpers ───────────────────────────────────────────────

// Students
export const getStudentByUSN = async (usn) => {
  const results = await queryDocuments('students', where('usn', '==', usn));
  return results[0] || null;
};

export const getStudentsByClass = async (classId) => {
  return queryDocuments('students', where('class_id', '==', classId));
};

// Timetable
export const getTimetableByClass = async (classId) => {
  return queryDocuments('timetable', where('class_id', '==', classId));
};

export const getTodayTimetable = async (classId) => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = days[new Date().getDay()];
  return queryDocuments(
    'timetable',
    where('class_id', '==', classId),
    where('day', '==', today)
  );
};

// Attendance
export const getAttendanceByStudent = async (studentId) => {
  return queryDocuments('attendance', where('student_id', '==', studentId));
};

export const getAttendanceSummary = (records) => {
  const subjectMap = {};
  records.forEach(({ subject, status }) => {
    if (!subjectMap[subject]) subjectMap[subject] = { present: 0, total: 0 };
    subjectMap[subject].total += 1;
    if (status === 'present') subjectMap[subject].present += 1;
  });
  return Object.entries(subjectMap).map(([subject, { present, total }]) => ({
    subject,
    present,
    total,
    percentage: total ? Math.round((present / total) * 100) : 0,
  }));
};

// Leave Requests
export const getLeaveRequestsByStudent = async (studentId) => {
  return queryDocuments('leaveRequests', where('student_id', '==', studentId));
};

export const getPendingLeaveRequests = async (classId) => {
  return queryDocuments('leaveRequests', where('status', '==', 'pending'));
};

// Marks
export const getMarksByStudent = async (studentId) => {
  return queryDocuments('marks', where('student_id', '==', studentId));
};

// AICTE Points
export const getAICTEByStudent = async (studentId) => {
  return queryDocuments('aictePoints', where('student_id', '==', studentId));
};

export const getAICTEByMentor = async (mentorId) => {
  // Get all mentee student IDs first, then fetch their AICTE points
  const mentees = await queryDocuments('students', where('mentor_id', '==', mentorId));
  const menteeIds = mentees.map((m) => m.id);
  const allPoints = [];
  for (const sid of menteeIds) {
    const points = await queryDocuments(
      'aictePoints',
      where('student_id', '==', sid),
      where('status', '==', 'pending')
    );
    allPoints.push(...points);
  }
  return allPoints;
};

// Marks Cards
export const getMarksCardsByStudent = async (studentId) => {
  return queryDocuments('marksCards', where('student_id', '==', studentId));
};

// Events
export const listenEvents = (callback) => {
  return listenCollection('events', callback, orderBy('date', 'desc'));
};

// Comments (timetable issues)
export const getCommentsByTimetable = async (timetableId) => {
  return queryDocuments('comments', where('timetable_id', '==', timetableId));
};

export const getPendingComments = async () => {
  return queryDocuments('comments', where('status', '==', 'pending'));
};

// Notifications
export const listenNotifications = (userId, callback) => {
  return listenCollection(
    'notifications',
    callback,
    where('user_id', '==', userId),
    orderBy('createdAt', 'desc')
  );
};

export const markNotificationRead = async (notifId) => {
  return updateDocument('notifications', notifId, { read_status: true });
};

export const addNotification = async (userId, message) => {
  return addDocument('notifications', {
    user_id: userId,
    message,
    read_status: false,
  });
};

// ChangeLog
export const addChangeLog = async (timetableId, oldValue, newValue, changedBy) => {
  return addDocument('changeLog', {
    timetable_id: timetableId,
    old_value: oldValue,
    new_value: newValue,
    changed_by: changedBy,
    timestamp: serverTimestamp(),
  });
};

export { where, orderBy, serverTimestamp };
