const crypto = require('crypto');
const sdk = require('node-appwrite');
const nodemailer = require('nodemailer');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.VITE_APPWRITE_API_KEY || process.env.APPWRITE_API_KEY;
  const endpoint = process.env.VITE_APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1';
  const projectId = process.env.VITE_APPWRITE_PROJECT_ID || '6a084d8900251e5c0f6e';
  const databaseId = process.env.VITE_APPWRITE_DATABASE_ID || '6a084e9b00061aea385a';
  
  const smtpEmail = process.env.SMTP_EMAIL;
  const smtpPassword = process.env.SMTP_PASSWORD;

  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server configuration error (missing Appwrite API Key).' })
    };
  }

  try {
    const { usn, role } = JSON.parse(event.body);

    if (!usn || !role) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'USN/Username and Role are required.' })
      };
    }

    if (role === 'admin') {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Password recovery is not supported for Admin accounts.' })
      };
    }

    // Prepare search queries for USN (case insensitive array match)
    const usnVariants = [usn, usn.toUpperCase(), usn.toLowerCase()];
    // Unique variants
    const uniqueUsnVariants = [...new Set(usnVariants)];

    // Prepare roles matching the selection
    const roleVariants = role === 'teacher' ? ['teacher', 'mentor'] : [role];

    // Initialize Appwrite Client & Databases
    const client = new sdk.Client()
      .setEndpoint(endpoint)
      .setProject(projectId)
      .setKey(apiKey);
    
    const databases = new sdk.Databases(client);

    let searchData;
    try {
      searchData = await databases.listDocuments(databaseId, 'userRoles', [
        sdk.Query.equal('usn', uniqueUsnVariants),
        sdk.Query.equal('role', roleVariants)
      ]);
    } catch (err) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `Database search failed: ${err.message}` })
      };
    }

    if (!searchData.documents || searchData.documents.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'No account found matching this USN and Role.' })
      };
    }

    const userDoc = searchData.documents[0];
    const email = userDoc.email;
    const uid = userDoc.uid;

    if (!email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No email address is registered for this account. Please contact your administrator.' })
      };
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Mask email for client presentation (e.g. s***t@gmail.com)
    let maskedEmail = email;
    if (email.includes('@')) {
      const [local, domain] = email.split('@');
      if (local.length > 2) {
        maskedEmail = `${local[0]}***${local[local.length - 1]}@${domain}`;
      } else {
        maskedEmail = `***@${domain}`;
      }
    }

    // Encrypt OTP, uid and expiry into a stateless token
    const expiry = Date.now() + 5 * 60 * 1000; // 5 minutes
    const tokenData = JSON.stringify({ otp, uid, expiry });
    
    const algorithm = 'aes-256-cbc';
    const secretKey = crypto.createHash('sha256').update(apiKey).digest();
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
    let encrypted = cipher.update(tokenData, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const token = iv.toString('hex') + ':' + encrypted;

    // Send Email via Nodemailer
    if (smtpEmail && smtpPassword) {
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: smtpEmail, pass: smtpPassword }
        });
        
        const mailOptions = {
          from: `"Campus Twin Admin" <${smtpEmail}>`,
          to: email,
          subject: 'Your Campus Twin Password Reset Code',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
              <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 24px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">Campus Twin</h1>
                <p style="color: #bfdbfe; margin-top: 8px; font-size: 14px;">Password Reset Request</p>
              </div>
              <div style="padding: 32px; background: white; text-align: center;">
                <p style="font-size: 16px; color: #334155; margin-bottom: 24px;">
                  You requested a password reset. Please use the 6-digit code below to verify your identity:
                </p>
                <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #0f172a; display: inline-block;">
                  ${otp}
                </div>
                <p style="font-size: 14px; color: #64748b; margin-top: 24px;">
                  This code is valid for 5 minutes. If you didn't request this, you can safely ignore this email.
                </p>
              </div>
            </div>
          `
        };

        await transporter.sendMail(mailOptions);
        console.log(`[Email Sent] Password reset OTP sent to ${email}`);

        return {
          statusCode: 200,
          body: JSON.stringify({ success: true, uid, maskedEmail, token })
        };

      } catch (emailErr) {
        console.error('[Email Error]:', emailErr);
        // Fallback to demo mode
        return {
          statusCode: 200,
          body: JSON.stringify({ success: true, uid, maskedEmail, token, demoMode: true, demoOtp: otp })
        };
      }
    } else {
      console.log(`[Demo Mode] OTP for ${email} is ${otp} (SMTP credentials not set)`);
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, uid, maskedEmail, token, demoMode: true, demoOtp: otp })
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
