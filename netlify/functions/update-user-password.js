exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // The Appwrite Server API Key must be set in Netlify Environment Variables
  const apiKey = process.env.VITE_APPWRITE_API_KEY || process.env.APPWRITE_API_KEY;

  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server API key missing. Please configure VITE_APPWRITE_API_KEY or APPWRITE_API_KEY in Netlify.' })
    };
  }

  try {
    const { uid, password, endpoint, projectId } = JSON.parse(event.body);

    if (!uid || !password) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'UID and password are required.' })
      };
    }

    if (password.length < 6) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Password must be at least 6 characters.' })
      };
    }

    const sdk = require('node-appwrite');
    const client = new sdk.Client()
      .setEndpoint(endpoint)
      .setProject(projectId)
      .setKey(apiKey);
    
    const databases = new sdk.Databases(client);
    const databaseId = process.env.VITE_APPWRITE_DATABASE_ID || '6a084e9b00061aea385a';

    try {
      const userRoleDoc = await databases.getDocument(databaseId, 'userRoles', uid);
      if (userRoleDoc && (userRoleDoc.is_super_admin || userRoleDoc.usn === 'admin' || userRoleDoc.email === 'admin@campustwin.edu')) {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: 'The Super Admin password cannot be changed.' })
        };
      }
    } catch (dbErr) {
      console.warn('Could not retrieve user role doc in update password function:', dbErr.message);
      if (uid === '6a0e19cb002f44b57eef') {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: 'The Super Admin password cannot be changed.' })
        };
      }
    }

    const res = await fetch(`${endpoint}/users/${uid}/password`, {
      method: 'PATCH',
      headers: {
        'X-Appwrite-Project': projectId,
        'X-Appwrite-Key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password })
    });

    if (!res.ok) {
      const text = await res.text();
      let data = {};
      try {
        data = JSON.parse(text);
      } catch (e) {}

      return {
        statusCode: res.status,
        body: JSON.stringify({ error: data.message || 'Failed to update user password in Appwrite Auth.' })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: `Password successfully updated.` }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
