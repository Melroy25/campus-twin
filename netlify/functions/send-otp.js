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
    const { email, otp } = JSON.parse(event.body);

    if (!email || !otp) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Email and OTP are required.' })
      };
    }

    // Demo mode: skip email and return OTP to client for display
    if (demoMode) {
      console.log(`[Demo Mode] OTP for ${email}: ${otp}`);
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          demoMode: true,
          demoOtp: otp,
          message: 'Demo mode — no email sent. OTP provided in response.'
        })
      };
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail', // You can change this if using another provider
      auth: {
        user: smtpEmail,
        pass: smtpPassword
      }
    });

    const mailOptions = {
      from: `"Campus Twin Admin" <${smtpEmail}>`,
      to: email,
      subject: 'Your Campus Twin Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Campus Twin</h1>
            <p style="color: #bfdbfe; margin-top: 8px; font-size: 14px;">Account Verification</p>
          </div>
          <div style="padding: 32px; background: white; text-align: center;">
            <p style="font-size: 16px; color: #334155; margin-bottom: 24px;">
              You requested an OTP for account verification. Please use the 6-digit code below:
            </p>
            <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #0f172a; display: inline-block;">
              ${otp}
            </div>
            <p style="font-size: 14px; color: #64748b; margin-top: 24px;">
              This code is valid for 5 minutes. Please do not share this code with anyone.
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
        message: 'Email sent successfully.'
      })
    };
  } catch (error) {
    console.error('[Email Error]:', error);
    // Fallback to demo mode if SMTP fails (e.g., wrong password)
    const { otp } = JSON.parse(event.body);
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        demoMode: true,
        demoOtp: otp,
        message: `Email Failed: ${error.message}. Falling back to demo mode.`
      })
    };
  }
};
