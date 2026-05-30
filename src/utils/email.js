// Email utility using EmailJS with mock fallback for testing
import { toast } from 'react-hot-toast';

export const sendCredentialsEmail = async (studentName, studentEmail, usn, password, role = 'student') => {
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

  // 1. Try to send via the Gmail SMTP Netlify function
  try {
    const res = await fetch('/.netlify/functions/send-credentials', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: studentName,
        email: studentEmail,
        usn: usn,
        password: password,
        role: role
      })
    });

    if (res.ok) {
      console.log(`[SMTP EMAIL] Successfully sent credentials to ${studentName} via SMTP Netlify function.`);
      return;
    } else {
      const errorRes = await res.json().catch(() => ({}));
      console.warn('[SMTP EMAIL] Netlify function returned error, falling back to EmailJS...', errorRes.error);
    }
  } catch (err) {
    console.warn('[SMTP EMAIL] Netlify function failed or not running, trying EmailJS fallback...', err.message);
  }

  const templateParams = {
    to_name: studentName,
    to_email: studentEmail,
    usn: usn,
    role: role,
    password: password,
    login_url: window.location.origin
  };

  // 2. EmailJS Fallback
  if (serviceId && templateId && publicKey) {
    try {
      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          service_id: serviceId,
          template_id: templateId,
          user_id: publicKey,
          template_params: templateParams
        })
      });

      if (response.ok) {
        console.log(`[EMAILJS] Successfully sent credentials to ${studentName} via EmailJS.`);
        return;
      }
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to send email via EmailJS');
    } catch (error) {
      console.error('[EMAILJS] Error:', error);
      throw error;
    }
  }

  // 3. Developer Mock Mode Fallback
  console.log(`[MOCK EMAIL] Dispatching credentials:
--------------------------------------------------
To: ${studentName} (${studentEmail})
Subject: Your Campus Twin Credentials

This is your Campus Twin credentials

USN: ${usn}
Role: ${role}
Password: ${password}
--------------------------------------------------`);
  return new Promise((resolve) => setTimeout(resolve, 800));
};

