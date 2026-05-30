const nodemailer = require('nodemailer');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const smtpEmail = process.env.SMTP_EMAIL;
  const smtpPassword = process.env.SMTP_PASSWORD;
  
  let demoMode = false;
  if (!smtpEmail || !smtpPassword) {
    console.log('[Demo Mode] SMTP credentials are missing in .env. Falling back to Demo Mode.');
    demoMode = true;
  }

  try {
    const { name, email, usn, password, role } = JSON.parse(event.body);

    if (!name || !email || !usn || !password) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Name, Email, USN, and Password are required.' })
      };
    }

    const resolvedRole = role || 'student';

    // Demo mode: skip email and log to server
    if (demoMode) {
      console.log(`[Demo Mode] Credentials for ${name} (${email}): USN=${usn}, Password=${password}, Role=${resolvedRole}`);
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          demoMode: true,
          message: 'Demo mode — no email sent.'
        })
      };
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: smtpEmail,
        pass: smtpPassword
      }
    });

    const mailOptions = {
      from: `"Campus Twin Admin" <${smtpEmail}>`,
      to: email,
      subject: 'Your Campus Twin Credentials',
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 32px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">Campus Twin</h1>
            <p style="color: #bfdbfe; margin-top: 8px; font-size: 15px; font-weight: 500;">Your Account Credentials</p>
          </div>
          <div style="padding: 32px 24px; background: white; color: #334155;">
            <p style="font-size: 16px; line-height: 1.6; color: #475569; margin-bottom: 24px;">
              Hello <strong>${name}</strong>,<br/><br/>
              Your account has been created on <strong>Campus Twin</strong>. Please use the following official credentials to log in:
            </p>
            
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 15px;">
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: 600; width: 100px;">USN:</td>
                  <td style="padding: 6px 0; color: #0f172a; font-weight: 700; font-family: monospace;">${usn}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Role:</td>
                  <td style="padding: 6px 0; color: #0f172a; font-weight: 700; text-transform: capitalize;">${resolvedRole}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Password:</td>
                  <td style="padding: 6px 0; color: #3b82f6; font-weight: 700; font-family: monospace; font-size: 16px;">${password}</td>
                </tr>
              </table>
            </div>

            <div style="text-align: center; margin-top: 32px; margin-bottom: 20px;">
              <a href="${event.headers.referer || event.headers.origin || 'http://localhost:5173'}" style="background: #3b82f6; color: white; padding: 12px 32px; border-radius: 10px; text-decoration: none; font-weight: 600; display: inline-block; box-shadow: 0 4px 10px rgba(59,130,246,0.25);">
                Log In to Campus Twin
              </a>
            </div>

            <p style="font-size: 13px; color: #94a3b8; text-align: center; margin-top: 32px; border-top: 1px solid #f1f5f9; padding-top: 16px;">
              For security, you will be required to change your password immediately upon your first login.
            </p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Credentials email sent successfully.'
      })
    };
  } catch (error) {
    console.error('[Email Credentials Error]:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `SMTP Failed to send: ${error.message}` })
    };
  }
};
