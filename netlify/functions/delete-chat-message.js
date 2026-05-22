exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.VITE_APPWRITE_API_KEY || process.env.APPWRITE_API_KEY;

  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server API key missing. Please configure VITE_APPWRITE_API_KEY or APPWRITE_API_KEY in Netlify.' })
    };
  }

  try {
    const { messageId, requesterUid, endpoint, projectId, databaseId } = JSON.parse(event.body);

    if (!messageId || !requesterUid || !endpoint || !projectId || !databaseId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required parameters: messageId, requesterUid, endpoint, projectId, databaseId.' })
      };
    }

    const headers = {
      'Content-Type': 'application/json',
      'X-Appwrite-Project': projectId,
      'X-Appwrite-Key': apiKey,
    };

    // 1. Fetch the message document
    const messageUrl = `${endpoint}/databases/${databaseId}/collections/class_messages/documents/${messageId}`;
    const messageRes = await fetch(messageUrl, { method: 'GET', headers });

    if (!messageRes.ok) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Message not found.' })
      };
    }

    const messageDoc = await messageRes.json();
    const senderId = messageDoc.sender_id;
    const classId = messageDoc.class_id;

    let authorized = false;

    // A. Check if the requester is the sender
    if (requesterUid === senderId) {
      authorized = true;
    }

    // B. If not authorized, check class advisor/mentor role
    if (!authorized && classId) {
      const classUrl = `${endpoint}/databases/${databaseId}/collections/classes/documents/${classId}`;
      const classRes = await fetch(classUrl, { method: 'GET', headers });
      if (classRes.ok) {
        const classDoc = await classRes.json();
        if (classDoc.advisor_id === requesterUid || classDoc.mentor_id === requesterUid) {
          authorized = true;
        }
      }
    }

    // C. If still not authorized, check if the user is an admin
    if (!authorized) {
      const roleUrl = `${endpoint}/databases/${databaseId}/collections/userRoles/documents/${requesterUid}`;
      const roleRes = await fetch(roleUrl, { method: 'GET', headers });
      if (roleRes.ok) {
        const roleDoc = await roleRes.json();
        if (roleDoc.role === 'admin') {
          authorized = true;
        }
      }
    }

    // D. Check for staff lounge room override
    if (!authorized && classId === 'staff-chat') {
      // In the staff chat, only admins or teachers can delete their own, but admins can delete any.
      const roleUrl = `${endpoint}/databases/${databaseId}/collections/userRoles/documents/${requesterUid}`;
      const roleRes = await fetch(roleUrl, { method: 'GET', headers });
      if (roleRes.ok) {
        const roleDoc = await roleRes.json();
        if (roleDoc.role === 'admin') {
          authorized = true;
        }
      }
    }

    if (!authorized) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Forbidden: You do not have permission to delete this message.' })
      };
    }

    // 2. Perform deletion
    const deleteRes = await fetch(messageUrl, { method: 'DELETE', headers });

    if (!deleteRes.ok) {
      const deleteText = await deleteRes.text();
      return {
        statusCode: deleteRes.status,
        body: JSON.stringify({ error: `Failed to delete message: ${deleteText}` })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Message successfully deleted.' })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
