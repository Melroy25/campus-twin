// Email utility using EmailJS with mock fallback for testing
import { toast } from 'react-hot-toast';

export const sendCredentialsEmail = async (studentName, studentEmail, usn, password) => {
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

  const templateParams = {
    to_name: studentName,
    to_email: studentEmail,
    usn: usn,
    password: password,
    login_url: window.location.origin
  };

  // If credentials are not set up, mock the email send
  if (!serviceId || !templateId || !publicKey) {
    console.log(`[MOCK EMAIL] Sending to ${studentName} (${studentEmail}):`, templateParams);
    return new Promise((resolve) => setTimeout(resolve, 800));
  }

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

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to send email via EmailJS');
    }
  } catch (error) {
    console.error('EmailJS error:', error);
    throw error;
  }
};
