import { storage, BUCKET_ID, PROJECT_ID, ENDPOINT } from './config';
import { ID } from 'appwrite';

/**
 * Upload a file to Appwrite storage and return its view URL
 */
export const uploadFile = async (file) => {
  if (!file) return null;
  try {
    const response = await storage.createFile(BUCKET_ID, ID.unique(), file);
    return `${ENDPOINT}/storage/buckets/${BUCKET_ID}/files/${response.$id}/view?project=${PROJECT_ID}`;
  } catch (error) {
    console.error('Upload Error:', error);
    throw error;
  }
};

/**
 * Upload an image specifically for AICTE points
 */
export const uploadAICTEImage = async (userId, file) => {
  return await uploadFile(file);
};
export const uploadAICTEProof = uploadAICTEImage;

/**
 * Upload a PDF marks card
 */
export const uploadMarksCardPDF = async (studentId, semester, file) => {
  return await uploadFile(file);
};
export const uploadMarksCard = uploadMarksCardPDF;

/**
 * Upload an image for an event
 */
export const uploadEventImage = async (file) => {
  return await uploadFile(file);
};


/**
 * Upload an image for a complaint
 */
export const uploadComplaintImage = async (file) => {
  return await uploadFile(file);
};

/**
 * Upload a leave request image/document
 */
export const uploadLeaveImage = async (userId, file) => {
  return await uploadFile(file);
};
