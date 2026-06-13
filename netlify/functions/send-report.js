const nodemailer = require('nodemailer');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const smtpEmail = process.env.SMTP_EMAIL;
  const smtpPassword = process.env.SMTP_PASSWORD;
  
  let demoMode = false;
  if (!smtpEmail || !smtpPassword) {
    console.log('[Demo Mode] SMTP credentials missing in .env. Falling back to Demo Mode.');
    demoMode = true;
  }

  try {
    const { studentName, usn, classLabel, email, marksList, attendancePct } = JSON.parse(event.body);

    if (!email || !studentName || !usn) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required student details or parent email.' })
      };
    }

    // Demo Mode fallback
    if (demoMode) {
      console.log(`[Demo Mode] Report sent to ${email} for ${studentName} (${usn})`);
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          demoMode: true,
          message: `Demo Mode: Email simulated for ${studentName} (${usn}).`
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

    // Format marks HTML
    let marksRowsHTML = '';
    if (marksList && marksList.length > 0) {
      marksList.forEach(m => {
        marksRowsHTML += `
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #334155;">${m.subject}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: bold; color: #1e1b4b; text-align: center;">${m.score} / 50</td>
          </tr>
        `;
      });
    } else {
      marksRowsHTML = `
        <tr>
          <td colspan="2" style="padding: 12px; text-align: center; color: #64748b; font-size: 14px;">No CIE marks records uploaded yet.</td>
        </tr>
      `;
    }

    const mailOptions = {
      from: `"Campus Twin Admin" <${smtpEmail}>`,
      to: email,
      subject: `Academic Performance Report: ${studentName} (${usn})`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background-color: #f8fafc;">
          <div style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); padding: 24px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 22px; letter-spacing: 0.5px;">CAMPUS TWIN PORTAL</h1>
            <p style="margin: 6px 0 0 0; color: #c7d2fe; font-size: 13px;">Official Academic Progress Report</p>
          </div>
          
          <div style="padding: 24px; background: white; margin: 16px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <h2 style="color: #0f172a; font-size: 18px; margin-top: 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Student Profile</h2>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
              <tr>
                <td style="padding: 6px 0; font-size: 14px; color: #64748b; width: 35%;">Student Name:</td>
                <td style="padding: 6px 0; font-size: 14px; font-weight: bold; color: #0f172a;">${studentName}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-size: 14px; color: #64748b;">University USN:</td>
                <td style="padding: 6px 0; font-size: 14px; font-weight: bold; color: #0f172a;">${usn}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-size: 14px; color: #64748b;">Class/Section:</td>
                <td style="padding: 6px 0; font-size: 14px; font-weight: bold; color: #0f172a;">${classLabel}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-size: 14px; color: #64748b;">Avg. Attendance:</td>
                <td style="padding: 6px 0; font-size: 14px; font-weight: bold; color: ${attendancePct >= 75 ? '#10b981' : '#ef4444'};">
                  ${attendancePct !== null && attendancePct !== undefined ? `${attendancePct}%` : '—'}
                </td>
              </tr>
            </table>

            <h2 style="color: #0f172a; font-size: 18px; margin-top: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">CIE Internal Marks</h2>
            <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
              <thead>
                <tr style="background-color: #f1f5f9;">
                  <th style="padding: 10px; text-align: left; font-size: 12px; font-weight: bold; color: #475569; text-transform: uppercase;">Subject</th>
                  <th style="padding: 10px; text-align: center; font-size: 12px; font-weight: bold; color: #475569; text-transform: uppercase; width: 30%;">Score Obtained</th>
                </tr>
              </thead>
              <tbody>
                ${marksRowsHTML}
              </tbody>
            </table>
          </div>
          
          <div style="padding: 16px; text-align: center; color: #94a3b8; font-size: 11px;">
            This is an automated performance update sent by the college academic cell via the Campus Twin system. Please do not reply directly to this email. For queries, kindly contact your student's class advisor.
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: `Email report dispatched to ${email} successfully.`
      })
    };
  } catch (error) {
    console.error('[Email Dispatch Error]:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Internal Server Error: ${error.message}` })
    };
  }
};
