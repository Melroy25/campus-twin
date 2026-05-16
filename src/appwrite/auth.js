import { account, PROJECT_ID, ENDPOINT } from './config';
import { ID } from 'appwrite';

/**
 * Log in a user using email and password
 */
export const loginUser = async (email, password) => {
  try {
    return await account.createEmailPasswordSession(email, password);
  } catch (error) {
    if (error.code === 401) throw { code: 'auth/wrong-password' };
    if (error.code === 404) throw { code: 'auth/user-not-found' };
    throw error;
  }
};

/**
 * Log out the currently authenticated user
 */
export const logoutUser = async () => {
  try {
    await account.deleteSession('current');
  } catch (error) {
    console.error('Logout error:', error);
  }
};

/**
 * Get current user session (to act as the onAuthStateChanged)
 */
export const getCurrentUser = async () => {
  try {
    const session = await account.getSession('current');
    if (session) {
      const user = await account.get();
      return {
        uid: user.$id,
        email: user.email,
        name: user.name
      };
    }
  } catch (error) {
    return null;
  }
  return null;
};

/**
 * Create a new user account without logging out the current admin.
 * This utilizes a Netlify serverless function to securely call the Appwrite Server API.
 */
export const createNewUser = async (email, password, name) => {
  // If not running on a Netlify environment (like local dev without netlify dev),
  // this function expects the proxy to be available or you'd need to mock it.
  try {
    const res = await fetch('/.netlify/functions/create-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        name,
        endpoint: ENDPOINT,
        projectId: PROJECT_ID,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to create user');
    }

    // Returns a pseudo-user object consistent with Firebase's format
    return {
      user: {
        uid: data.$id,
        email: data.email,
        name: data.name
      }
    };
  } catch (error) {
    throw error;
  }
};
