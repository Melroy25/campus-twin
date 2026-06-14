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
    const { studentName, usn, classLabel, email, marksList, attendancePct, attendanceList } = JSON.parse(event.body);

    if (!email || !studentName || !usn) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required student details or parent email.' })
      };
    }

    // Replace semicolons with commas to support multiple recipients in Nodemailer
    const formattedEmail = email.replace(/;/g, ',');

    // Demo Mode fallback
    if (demoMode) {
      console.log(`[Demo Mode] Report sent to ${formattedEmail} for ${studentName} (${usn})`);
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

    // Format attendance HTML
    let attendanceRowsHTML = '';
    if (attendanceList && attendanceList.length > 0) {
      attendanceList.forEach(a => {
        attendanceRowsHTML += `
          <tr>
            <td style="padding: 10px 6px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: bold; color: #334155;">${a.subject}</td>
            <td style="padding: 10px 6px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #334155; text-align: center;">${a.present}</td>
            <td style="padding: 10px 6px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #334155; text-align: center;">${a.absent}</td>
            <td style="padding: 10px 6px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: bold; color: ${a.percentage >= 75 ? '#10b981' : '#ef4444'}; text-align: center;">${a.percentage}%</td>
          </tr>
        `;
      });
    } else {
      attendanceRowsHTML = `
        <tr>
          <td colspan="4" style="padding: 12px; text-align: center; color: #64748b; font-size: 14px;">No attendance records uploaded yet.</td>
        </tr>
      `;
    }

    // Format marks HTML
    let marksRowsHTML = '';
    if (marksList && marksList.length > 0) {
      marksList.forEach(m => {
        const ia1Val = m.ia1 !== null ? `${m.ia1}/50` : '—';
        const ia2Val = m.ia2 !== null ? `${m.ia2}/50` : '—';
        const ass1Val = m.ass1 !== null ? `${m.ass1}/10` : '—';
        const ass2Val = m.ass2 !== null ? `${m.ass2}/10` : '—';
        const lab1Val = m.lab1 !== null ? (m.lab1 === 'NA' ? 'NA' : `${m.lab1}/50`) : '—';
        const lab2Val = m.lab2 !== null ? (m.lab2 === 'NA' ? 'NA' : `${m.lab2}/50`) : '—';
        const totalMax = m.isLegacy ? 30 : 50;

        marksRowsHTML += `
          <tr>
            <td style="padding: 10px 6px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: bold; color: #334155;">${m.subject}</td>
            <td style="padding: 10px 4px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #475569; text-align: center;">${ia1Val}</td>
            <td style="padding: 10px 4px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #475569; text-align: center;">${ia2Val}</td>
            <td style="padding: 10px 4px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #475569; text-align: center;">${ass1Val}</td>
            <td style="padding: 10px 4px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #475569; text-align: center;">${ass2Val}</td>
            <td style="padding: 10px 4px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #475569; text-align: center;">${lab1Val}</td>
            <td style="padding: 10px 4px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #475569; text-align: center;">${lab2Val}</td>
            <td style="padding: 10px 6px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: bold; color: ${m.color || '#1e1b4b'}; text-align: center;">${m.total} / ${totalMax}</td>
            <td style="padding: 10px 6px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-align: center;">
              <span style="background-color: ${m.color}15; color: ${m.color || '#1e1b4b'}; border: 1px solid ${m.color}30; font-weight: bold; font-size: 11px; padding: 2px 6px; border-radius: 4px;">
                ${m.grade}
              </span>
            </td>
          </tr>
        `;
      });
    } else {
      marksRowsHTML = `
        <tr>
          <td colspan="9" style="padding: 12px; text-align: center; color: #64748b; font-size: 14px;">No CIE marks records uploaded yet.</td>
        </tr>
      `;
    }

    const mailOptions = {
      from: `"Campus Twin Admin" <${smtpEmail}>`,
      to: formattedEmail,
      subject: `Academic Performance Report: ${studentName} (${usn})`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background-color: #f8fafc;">
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

            <h2 style="color: #0f172a; font-size: 17px; margin-top: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px;">Subject-wise Attendance Breakdown</h2>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
              <thead>
                <tr style="background-color: #f1f5f9;">
                  <th style="padding: 10px 6px; text-align: left; font-size: 11px; font-weight: bold; color: #475569; text-transform: uppercase;">Subject</th>
                  <th style="padding: 10px 6px; text-align: center; font-size: 11px; font-weight: bold; color: #475569; text-transform: uppercase; width: 20%;">Present</th>
                  <th style="padding: 10px 6px; text-align: center; font-size: 11px; font-weight: bold; color: #475569; text-transform: uppercase; width: 20%;">Absent</th>
                  <th style="padding: 10px 6px; text-align: center; font-size: 11px; font-weight: bold; color: #475569; text-transform: uppercase; width: 20%;">Percentage</th>
                </tr>
              </thead>
              <tbody>
                ${attendanceRowsHTML}
              </tbody>
            </table>

            <h2 style="color: #0f172a; font-size: 17px; margin-top: 28px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px;">Subject-wise CIE Breakdown</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background-color: #f1f5f9;">
                  <th style="padding: 10px 6px; text-align: left; font-size: 10px; font-weight: bold; color: #475569; text-transform: uppercase;">Subject</th>
                  <th style="padding: 10px 4px; text-align: center; font-size: 9px; font-weight: bold; color: #475569; text-transform: uppercase; width: 10%;">IA 1</th>
                  <th style="padding: 10px 4px; text-align: center; font-size: 9px; font-weight: bold; color: #475569; text-transform: uppercase; width: 10%;">IA 2</th>
                  <th style="padding: 10px 4px; text-align: center; font-size: 9px; font-weight: bold; color: #475569; text-transform: uppercase; width: 10%;">Assg 1</th>
                  <th style="padding: 10px 4px; text-align: center; font-size: 9px; font-weight: bold; color: #475569; text-transform: uppercase; width: 10%;">Assg 2</th>
                  <th style="padding: 10px 4px; text-align: center; font-size: 9px; font-weight: bold; color: #475569; text-transform: uppercase; width: 10%;">Lab 1</th>
                  <th style="padding: 10px 4px; text-align: center; font-size: 9px; font-weight: bold; color: #475569; text-transform: uppercase; width: 10%;">Lab 2</th>
                  <th style="padding: 10px 6px; text-align: center; font-size: 10px; font-weight: bold; color: #475569; text-transform: uppercase; width: 18%;">Total</th>
                  <th style="padding: 10px 6px; text-align: center; font-size: 10px; font-weight: bold; color: #475569; text-transform: uppercase; width: 12%;">Grade</th>
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
        message: `Email report dispatched to ${formattedEmail} successfully.`
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
