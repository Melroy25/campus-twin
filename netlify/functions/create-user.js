exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // The Appwrite Server API Key must be set in Netlify Environment Variables
  // Go to Netlify -> Site Settings -> Environment Variables -> Add VITE_APPWRITE_API_KEY
  const apiKey = process.env.VITE_APPWRITE_API_KEY;

  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server API key missing. Please configure VITE_APPWRITE_API_KEY in Netlify.' })
    };
  }

  try {
    const { email, password, name, endpoint, projectId } = JSON.parse(event.body);

    const res = await fetch(`${endpoint}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Appwrite-Project': projectId,
        'X-Appwrite-Key': apiKey,
      },
      body: JSON.stringify({
        userId: 'unique()',
        email,
        password,
        name
      })
    });

    const data = await res.json();
    
    if (!res.ok) {
      return {
        statusCode: res.status,
        body: JSON.stringify({ error: data.message || 'Failed to create user in Appwrite.' })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
