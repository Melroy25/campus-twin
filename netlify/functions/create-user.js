exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // The Appwrite Server API Key must be set in Netlify Environment Variables
  // Go to Netlify -> Site Settings -> Environment Variables -> Add VITE_APPWRITE_API_KEY
  const apiKey = process.env.VITE_APPWRITE_API_KEY || process.env.APPWRITE_API_KEY;

  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server API key missing. Please configure VITE_APPWRITE_API_KEY or APPWRITE_API_KEY in Netlify.' })
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

    let data;
    try {
      data = await res.json();
    } catch (e) {
      data = {};
    }
    
    if (!res.ok) {
      // If user already exists (409 Conflict), try to find the existing user
      if (res.status === 409 || (data.message && data.message.includes('already exists'))) {
        try {
          const searchRes = await fetch(`${endpoint}/users?search=${encodeURIComponent(email)}`, {
            method: 'GET',
            headers: {
              'X-Appwrite-Project': projectId,
              'X-Appwrite-Key': apiKey,
            }
          });
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            const existingUser = searchData.users?.find(u => u.email.toLowerCase() === email.toLowerCase());
            if (existingUser) {
              // Update the password of the existing user to match what the admin specified
              try {
                await fetch(`${endpoint}/users/${existingUser.$id}/password`, {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json',
                    'X-Appwrite-Project': projectId,
                    'X-Appwrite-Key': apiKey,
                  },
                  body: JSON.stringify({ password })
                });
              } catch (passwordErr) {
                console.error('Failed to update existing user password:', passwordErr);
              }

              return {
                statusCode: 200,
                body: JSON.stringify(existingUser),
              };
            }
          }
        } catch (searchErr) {
          console.error('Failed to search for existing user:', searchErr);
        }
      }

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
