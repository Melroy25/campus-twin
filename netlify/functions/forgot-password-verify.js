const crypto = require('crypto');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.VITE_APPWRITE_API_KEY || process.env.APPWRITE_API_KEY;
  const endpoint = process.env.VITE_APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1';
  const projectId = process.env.VITE_APPWRITE_PROJECT_ID || '6a084d8900251e5c0f6e';
  const databaseId = process.env.VITE_APPWRITE_DATABASE_ID || '6a084e9b00061aea385a';

  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server configuration error (missing Appwrite API Key).' })
    };
  }

  try {
    const { uid, otp, token, newPassword } = JSON.parse(event.body);

    if (!uid || !otp || !token || !newPassword) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields: uid, otp, token, newPassword.' })
      };
    }

    if (newPassword.length < 8) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Password must be at least 8 characters long.' })
      };
    }

    // Decrypt the token
    let decryptedData;
    try {
      const algorithm = 'aes-256-cbc';
      const secretKey = crypto.createHash('sha256').update(apiKey).digest();
      const parts = token.split(':');
      const ivPart = Buffer.from(parts[0], 'hex');
      const encryptedPart = Buffer.from(parts[1], 'hex');
      
      const decipher = crypto.createDecipheriv(algorithm, secretKey, ivPart);
      let decrypted = decipher.update(encryptedPart, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      decryptedData = JSON.parse(decrypted);
    } catch (err) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid or tampered verification token.' })
      };
    }

    const { otp: tokenOtp, uid: tokenUid, expiry } = decryptedData;

    // Verify values
    if (tokenOtp !== otp) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid verification code. Please try again.' })
      };
    }

    if (tokenUid !== uid) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Token user mismatch error.' })
      };
    }

    if (Date.now() > expiry) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Verification code has expired. Please try again.' })
      };
    }

    // 1. Update user password in Appwrite Auth using node-appwrite SDK
    const sdk = require('node-appwrite');
    const client = new sdk.Client()
      .setEndpoint(endpoint)
      .setProject(projectId)
      .setKey(apiKey);
    
    const users = new sdk.Users(client);
    
    try {
      await users.updatePassword(uid, newPassword);
    } catch (authErr) {
      console.error('[Appwrite Auth Password Update Error]:', authErr);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: authErr.message || 'Failed to update user password in Appwrite Auth.' })
      };
    }

    // 2. Update must_change_password to false in userRoles collection
    try {
      const databases = new sdk.Databases(client);
      await databases.updateDocument(databaseId, 'userRoles', uid, {
        must_change_password: false
      });
    } catch (dbErr) {
      console.error('Error updating must_change_password in database:', dbErr);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Password updated successfully! You can now log in.' })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
