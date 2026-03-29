import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './config';

/**
 * Upload a file to Firebase Storage
 * @param {File} file - The file to upload
 * @param {string} path - Storage path e.g. 'leaveRequests/student_id/filename'
 * @returns {Promise<string>} Download URL
 */
export const uploadFile = async (file, path) => {
  const storageRef = ref(storage, path);
  const snapshot = await uploadBytes(storageRef, file);
  return await getDownloadURL(snapshot.ref);
};

/**
 * Delete a file from Firebase Storage
 * @param {string} path - Full storage path or download URL
 */
export const deleteFile = async (path) => {
  const storageRef = ref(storage, path);
  await deleteObject(storageRef);
};

/**
 * Upload profile picture for user
 */
export const uploadProfilePicture = async (userId, file) => {
  return uploadFile(file, `profilePictures/${userId}/${file.name}`);
};

/**
 * Upload leave request image
 */
export const uploadLeaveImage = async (studentId, file) => {
  const timestamp = Date.now();
  return uploadFile(file, `leaveRequests/${studentId}/${timestamp}_${file.name}`);
};

/**
 * Upload AICTE proof file
 */
export const uploadAICTEProof = async (studentId, file) => {
  const timestamp = Date.now();
  return uploadFile(file, `aicteProofs/${studentId}/${timestamp}_${file.name}`);
};

/**
 * Upload marks card PDF
 */
export const uploadMarksCard = async (studentId, semester, file) => {
  return uploadFile(file, `marksCards/${studentId}/sem${semester}_${file.name}`);
};

/**
 * Upload event image
 */
export const uploadEventImage = async (file) => {
  const timestamp = Date.now();
  return uploadFile(file, `events/${timestamp}_${file.name}`);
};
