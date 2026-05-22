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
  try {
    // 1. Try to use the Netlify function first (preferred in production)
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

    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      throw new Error(`Invalid server response: ${text.substring(0, 100)}`);
    }

    if (!res.ok) {
      throw new Error(data.error || `Server returned status ${res.status}`);
    }

    return {
      user: {
        uid: data.$id,
        email: data.email,
        name: data.name
      }
    };
  } catch (error) {
    console.warn('Netlify function registration failed, attempting client-side fallback:', error.message);
    
    // 2. Fallback to client-side registration using Appwrite SDK
    try {
      const user = await account.create(ID.unique(), email, password, name);
      return {
        user: {
          uid: user.$id,
          email: user.email,
          name: user.name
        }
      };
    } catch (fallbackError) {
      console.error('Client-side registration fallback also failed:', fallbackError);
      throw new Error(fallbackError.message || 'Failed to create user account');
    }
  }
};

/**
 * Delete a user account from authentication using a Netlify serverless function
 */
export const deleteUserFromAuth = async (uid) => {
  try {
    const res = await fetch('/.netlify/functions/delete-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uid,
        endpoint: ENDPOINT,
        projectId: PROJECT_ID,
      }),
    });

    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      throw new Error(`Invalid server response: ${text.substring(0, 100)}`);
    }

    if (!res.ok) {
      throw new Error(data.error || `Server returned status ${res.status}`);
    }

    return true;
  } catch (error) {
    console.error('Failed to delete user from authentication:', error.message);
    throw error;
  }
};

