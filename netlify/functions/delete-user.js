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
    const { uid, endpoint, projectId } = JSON.parse(event.body);

    if (!uid) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'UID is required.' })
      };
    }

    const res = await fetch(`${endpoint}/users/${uid}`, {
      method: 'DELETE',
      headers: {
        'X-Appwrite-Project': projectId,
        'X-Appwrite-Key': apiKey,
      }
    });

    if (!res.ok) {
      const text = await res.text();
      let data = {};
      try {
        data = JSON.parse(text);
      } catch (e) {}
      return {
        statusCode: res.status,
        body: JSON.stringify({ error: data.message || 'Failed to delete user in Appwrite Auth.' })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: `User ${uid} successfully deleted from authentication.` }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
