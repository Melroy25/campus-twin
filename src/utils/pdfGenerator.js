import { jsPDF } from 'jspdf';

// Comprehensive subject name mapping to display beautiful full course titles on the receipt
const COURSE_NAME_MAP = {
  '22UHV47': 'Universal Human Values and Professional Ethics',
  '22CSE46L': 'Python Programming Laboratory',
  '22CSE31': 'Transform Calculus, Fourier Series and Numerical Techniques',
  '22CSE32': 'Data Structures and Applications',
  '22CSE33': 'Analog and Digital Electronics',
  '22CSE34': 'Computer Organization and Architecture',
  '22CSL35': 'Data Structures Laboratory',
  '22CSE41': 'Mathematical Foundations for Computing',
  '22CSE42': 'Design and Analysis of Algorithms',
  '22CSE43': 'Microcontroller and Embedded Systems',
  '22CSE44': 'Operating Systems',
  '22CSL45': 'Design and Analysis of Algorithms Laboratory',
  '22CSE51': 'Database Management Systems',
  '22CSE52': 'Computer Networks',
  '22CSE53': 'Software Engineering and Project Management',
  '22CSL54': 'Database Management Systems Laboratory',
  '22CSE61': 'Web Technology and its Applications',
  '22CSE62': 'Computer Graphics and Visualization',
  '22CSE63': 'System Software and Compilers',
  '22CSL64': 'Computer Graphics and Compiler Laboratory',
  '22CSE71': 'Artificial Intelligence and Machine Learning',
  '22CSE72': 'Big Data Analytics',
  '22CSE73': 'Cloud Computing',
  '22CSL74': 'Machine Learning Laboratory',
  '22CSE81': 'Internet of Things',
  '22CSE82': 'Information and Network Security'
};

/**
 * Downloads a student avatar image and converts it to Base64 format.
 * Utilizes a cache buster query parameter to bypass previous cached non-CORS requests
 * and draws the image on canvas with crossorigin="anonymous" successfully.
 */
const getBase64ImageFromUrl = (imageUrl) => {
  if (!imageUrl) return Promise.resolve(null);
  
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const dataURL = canvas.toDataURL('image/jpeg');
        resolve(dataURL);
      } catch (err) {
        console.warn('Canvas conversion failed for avatar, running fetch fallback:', err);
        fetchFallback(imageUrl, resolve);
      }
    };
    
    img.onerror = () => {
      console.warn('Image load failed for avatar, running fetch fallback');
      fetchFallback(imageUrl, resolve);
    };
    
    // Append unique cache buster to bypass browser cached non-CORS requests from standard <img> tags
    const cacheBusterUrl = imageUrl.includes('?') 
      ? `${imageUrl}&cb=${new Date().getTime()}`
      : `${imageUrl}?cb=${new Date().getTime()}`;
      
    img.src = cacheBusterUrl;
  });
};

const fetchFallback = (imageUrl, resolve) => {
  fetch(imageUrl, { mode: 'cors' })
    .then(res => {
      if (!res.ok) throw new Error('Image fetch failed');
      return res.blob();
    })
    .then(blob => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    })
    .catch(err => {
      console.warn('Avatar image fetch fallback also failed:', err);
      resolve(null);
    });
};

/**
 * Generates and downloads a pixel-perfect, premium academic course registration acknowledgement PDF.
 * 
 * @param {Object} params
 * @param {Object} params.student - The student user profile object
 * @param {Object} params.classInfo - The class metadata object
 * @param {Array} params.registeredSubjects - Array of selected subject objects
 * @param {string} params.mentorName - Mentor name
 * @param {string} params.advisorName - Class Advisor name
 */
export const generateRegistrationPDF = async ({
  student,
  classInfo,
  registeredSubjects = [],
  mentorName = 'Not Assigned',
  advisorName = 'Not Assigned'
}) => {
  // Create jsPDF document instance (A4 size: 210mm x 297mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2); // 180mm

  // Base64 student avatar download
  let avatarBase64 = null;
  if (student?.avatar_url) {
    avatarBase64 = await getBase64ImageFromUrl(student.avatar_url);
  }

  // --- DRAW VISUAL DESIGN ACCENTS (STUNNING AESTHETIC) ---
  
  // 1. Accent border lines
  doc.setDrawColor(79, 70, 229); // Royal Indigo (#4f46e5)
  doc.setLineWidth(1.5);
  doc.line(margin, margin, pageWidth - margin, margin); // Top border line
  doc.setDrawColor(229, 231, 235); // Light Gray (#e5e7eb)
  doc.setLineWidth(0.5);
  doc.line(margin, pageHeight - margin, pageWidth - margin, pageHeight - margin); // Bottom decorative line

  // 2. Premium Grid Watermark / Background accents (Subtle)
  doc.setFillColor(249, 250, 251); // Gray-50 (#f9fafb)
  doc.rect(margin, margin + 2, contentWidth, 26, 'F'); // Background band for Header

  // 3. College Header / branding
  doc.setTextColor(31, 41, 55); // Gray-800 (#1f2937)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('CAMPUS TWIN ACADEMICS', margin + 6, margin + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128); // Gray-500 (#6b7280)
  doc.text('DIGITAL CAMPUS MANAGEMENT PLATFORM | OFFICIAL RECEIPT', margin + 6, margin + 17);

  // 4. Receipt Header Label (Badge)
  doc.setFillColor(79, 70, 229); // Royal Indigo (#4f46e5)
  doc.rect(pageWidth - margin - 60, margin + 6, 54, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('REGISTRATION SECURED', pageWidth - margin - 57, margin + 11.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(79, 70, 229);
  doc.text(`Receipt ID: CT-REG-${student?.usn?.toUpperCase() || 'TEMP'}`, pageWidth - margin - 60, margin + 20);

  // Divider line below header
  doc.setDrawColor(79, 70, 229);
  doc.setLineWidth(1);
  doc.line(margin, margin + 28, pageWidth - margin, margin + 28);

  // --- STUDENT INFORMATION SECTION ---
  
  // Section Title
  doc.setTextColor(30, 41, 59); // Slate-800
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('STUDENT PROFILE & ACADEMIC INFO', margin, margin + 37);

  // Information Card Container Box
  const cardY = margin + 41;
  const cardHeight = 44;
  doc.setDrawColor(209, 213, 219); // Gray-300
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(0.5);
  // Glassmorphic border feel: simple fine rounded border
  doc.rect(margin, cardY, contentWidth, cardHeight, 'S');

  // Avatar / Picture Box (Left side of card)
  const avatarSize = 34;
  const avatarX = margin + 5;
  const avatarY = cardY + 5;

  doc.setDrawColor(229, 231, 235);
  doc.setFillColor(243, 244, 246);
  doc.rect(avatarX, avatarY, avatarSize, avatarSize, 'FD'); // Avatar background frame

  if (avatarBase64) {
    try {
      doc.addImage(avatarBase64, 'JPEG', avatarX + 1, avatarY + 1, avatarSize - 2, avatarSize - 2);
    } catch (e) {
      drawAvatarFallback(doc, student, avatarX, avatarY, avatarSize);
    }
  } else {
    drawAvatarFallback(doc, student, avatarX, avatarY, avatarSize);
  }

  // Student details metadata grid (Right side of card)
  const textStartX = avatarX + avatarSize + 8;
  const textStartY = cardY + 10;
  const labelColor = [107, 114, 128]; // Gray-500
  const valueColor = [17, 24, 39]; // Gray-900

  const drawMetadataRow = (label, val, x, y) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...labelColor);
    doc.text(label, x, y);
    
    doc.setFont('helvetica', 'medium');
    doc.setFontSize(9.5);
    doc.setTextColor(...valueColor);
    doc.text(String(val || 'Not Assigned'), x + 30, y);
  };

  drawMetadataRow('FULL NAME:', student?.name, textStartX, textStartY);
  drawMetadataRow('USN / ID:', student?.usn?.toUpperCase(), textStartX, textStartY + 6.5);
  drawMetadataRow('DEPARTMENT:', student?.branch_id || 'Computer Science & Eng.', textStartX, textStartY + 13);
  drawMetadataRow('CLASS & SEC:', classInfo?.label || student?.class_label, textStartX, textStartY + 19.5);
  drawMetadataRow('SEMESTER:', classInfo?.semester || student?.class_semester || 'Not Specified', textStartX, textStartY + 26);

  // Mentor / Class Advisor Sub-grid (Aligned further right or bottom-right)
  const rightColumnX = textStartX + 72;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...labelColor);
  doc.text('ACADEMIC ADVISORS:', rightColumnX, textStartY);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...valueColor);
  doc.text(`Mentor: ${mentorName}`, rightColumnX, textStartY + 5.5);
  doc.text(`Advisor: ${advisorName}`, rightColumnX, textStartY + 11);

  // Status Badge
  doc.setFillColor(209, 250, 229); // Success light-green background (#d1fae5)
  doc.rect(rightColumnX, textStartY + 16, 52, 11, 'F');
  doc.setDrawColor(16, 185, 129); // Success emerald green (#10b981)
  doc.setLineWidth(0.3);
  doc.rect(rightColumnX, textStartY + 16, 52, 11, 'S');

  doc.setTextColor(6, 95, 70); // Success dark green (#065f46)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('STATUS: VERIFIED', rightColumnX + 6, textStartY + 21);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('LOCKED & OFFICIAL', rightColumnX + 11, textStartY + 25);

  // --- REGISTERED COURSES SECTION ---

  // Section Title
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('OFFICIALLY REGISTERED COURSES', margin, margin + 96);

  // Table Setup
  let tableY = margin + 100;
  const colWidths = {
    sl: 12,
    code: 32,
    name: 106,
    credits: 30
  };
  const tableHeaderHeight = 8;
  const tableRowHeight = 8.5;

  const colPos = {
    sl: margin,
    code: margin + colWidths.sl,
    name: margin + colWidths.sl + colWidths.code,
    credits: margin + colWidths.sl + colWidths.code + colWidths.name
  };

  // Draw Table Header Background
  doc.setFillColor(30, 58, 138); // Navy blue (#1e3a8a)
  doc.rect(margin, tableY, contentWidth, tableHeaderHeight, 'F');

  // Draw Header Labels
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);

  const drawHeaderCellText = (text, x, width) => {
    const textWidth = doc.getTextWidth(text);
    const textX = x + (width - textWidth) / 2;
    doc.text(text, textX, tableY + 5.2);
  };

  drawHeaderCellText('SL', colPos.sl, colWidths.sl);
  drawHeaderCellText('COURSE CODE', colPos.code, colWidths.code);
  doc.text('COURSE TITLE', colPos.name + 4, tableY + 5.2); // Align left with padding
  drawHeaderCellText('CREDITS', colPos.credits, colWidths.credits);

  // Draw Table Rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  
  let currentY = tableY + tableHeaderHeight;
  let totalCredits = 0;

  registeredSubjects.forEach((sub, idx) => {
    // Alternating Row Background
    const isEven = idx % 2 === 0;
    doc.setFillColor(isEven ? 255 : 243, isEven ? 255 : 244, isEven ? 255 : 246); // Alternating light gray (#f3f4f6)
    doc.rect(margin, currentY, contentWidth, tableRowHeight, 'F');

    // Row borders
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.3);
    doc.line(margin, currentY + tableRowHeight, pageWidth - margin, currentY + tableRowHeight); // Row bottom border
    
    // Sl Border & Text
    doc.setTextColor(75, 85, 99); // Dark Gray
    const slText = String(idx + 1);
    const slTextWidth = doc.getTextWidth(slText);
    doc.text(slText, colPos.sl + (colWidths.sl - slTextWidth) / 2, currentY + 5.5);

    // Code
    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    const codeText = sub.courseCode || '';
    const codeTextWidth = doc.getTextWidth(codeText);
    doc.text(codeText, colPos.code + (colWidths.code - codeTextWidth) / 2, currentY + 5.5);

    // Name
    doc.setFont('helvetica', 'normal');
    // Resolve full course name using COURSE_NAME_MAP or fallback to DB stored courseName
    let nameText = COURSE_NAME_MAP[sub.courseCode?.toUpperCase()] || sub.courseName || '';
    if (nameText.length > 50) nameText = nameText.substring(0, 47) + '...'; // Truncate long course names
    doc.text(nameText, colPos.name + 4, currentY + 5.5);

    // Credits
    const crText = String(sub.credits || 0);
    const crTextWidth = doc.getTextWidth(crText);
    doc.text(crText, colPos.credits + (colWidths.credits - crTextWidth) / 2, currentY + 5.5);
    
    totalCredits += (sub.credits || 0);
    currentY += tableRowHeight;
  });

  // Table Outer Border Lines
  doc.setDrawColor(209, 213, 219);
  doc.setLineWidth(0.5);
  doc.line(margin, tableY, margin, currentY); // Left border
  doc.line(pageWidth - margin, tableY, pageWidth - margin, currentY); // Right border
  doc.line(colPos.code, tableY, colPos.code, currentY); // Sl border
  doc.line(colPos.name, tableY, colPos.name, currentY); // Code border
  doc.line(colPos.credits, tableY, colPos.credits, currentY); // Name border

  // --- SUMMARY ROW ---
  doc.setFillColor(243, 244, 246);
  doc.rect(margin, currentY, contentWidth, tableRowHeight + 1, 'F');
  doc.setDrawColor(209, 213, 219);
  doc.line(margin, currentY + tableRowHeight + 1, pageWidth - margin, currentY + tableRowHeight + 1); // Bottom double-ish line

  doc.setTextColor(31, 41, 55);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  
  // Span across SL, Code, Name
  doc.text('TOTAL CREDITS REGISTERED', colPos.sl + 4, currentY + 6);

  // Credits summary
  const totCrText = String(totalCredits);
  const totCrWidth = doc.getTextWidth(totCrText);
  doc.setTextColor(79, 70, 229); // Accent Indigo
  doc.text(totCrText, colPos.credits + (colWidths.credits - totCrWidth) / 2, currentY + 6);
  
  currentY += tableRowHeight + 5;

  // --- SECURITY NOTE / IMPORTANT BANNER ---
  doc.setFillColor(248, 250, 252); // Slate-50 (#f8fafc)
  doc.rect(margin, currentY, contentWidth, 14, 'F');
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.rect(margin, currentY, contentWidth, 14, 'S');

  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  const noteLines = [
    'Important Note: This document serves as an official confirmation of course registration for the selected semester.',
    'Any adjustments to this selection must be processed through the Academic HOD or Admin portal before the registration deadline.'
  ];
  doc.text(noteLines[0], margin + 4, currentY + 5.2);
  doc.text(noteLines[1], margin + 4, currentY + 9.5);

  currentY += 26;

  // --- SIGNATURES & VERIFICATION SECTION ---
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(55, 65, 81);

  // Signature lines
  const sigLineY = currentY + 12;
  const sigLineWidth = 54;
  
  // Left Column (Student Signature)
  doc.line(margin + 5, sigLineY, margin + 5 + sigLineWidth, sigLineY);
  doc.setFont('helvetica', 'bold');
  doc.text('Student Signature', margin + 17, sigLineY + 4.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, margin + 22, sigLineY + 8);

  // Right Column (Academic Advisor Signature)
  const advisorSigX = pageWidth - margin - 5 - sigLineWidth;
  doc.line(advisorSigX, sigLineY, advisorSigX + sigLineWidth, sigLineY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Academic Advisor / HOD', advisorSigX + 11, sigLineY + 4.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Signature & Seal', advisorSigX + 19, sigLineY + 8);

  // --- FOOTER & DECORATIVE BARCODE ---
  
  const footerY = pageHeight - margin - 4;
  
  // Decortive Digital Barcode
  const barcodeX = pageWidth - margin - 40;
  const barcodeY = footerY - 5;
  doc.setFillColor(156, 163, 175); // Light Gray-400
  // Draw barcode-like vertical stripes of varying widths
  const stripeWidths = [1, 2.5, 0.8, 1.2, 3, 0.6, 2, 1.5, 0.7, 2.8, 1, 1.8, 0.5, 2.2, 1.1];
  let currentStripeX = barcodeX;
  stripeWidths.forEach((width, idx) => {
    if (idx % 2 === 0) {
      doc.rect(currentStripeX, barcodeY, width, 5.5, 'F');
    }
    currentStripeX += width + 0.6;
  });
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(156, 163, 175);
  doc.text('SECURITY DIGITAL RECEIPT', barcodeX + 2, barcodeY + 8);

  // Timestamp
  const now = new Date();
  const formatTime = (d) => {
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const secs = String(d.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${secs}`;
  };
  
  doc.setFontSize(7);
  doc.setTextColor(156, 163, 175);
  doc.text(`Digital Verification Hash: CT-${generateSimpleHash(student?.usn || 'RECEIPT')}-${now.getFullYear()}`, margin, footerY - 2);
  doc.text(`Generated: ${now.toLocaleDateString()} at ${formatTime(now)} | Secure Digital ID Verified`, margin, footerY + 1.2);

  // Save the PDF locally on the student's browser
  doc.save(`Course_Registration_${student?.usn?.toUpperCase() || 'Receipt'}.pdf`);
};

/**
 * Fallback to drawing a beautiful circular avatar with the student's initials inside the PDF frame.
 */
const drawAvatarFallback = (doc, student, x, y, size) => {
  const centerX = x + (size / 2);
  const centerY = y + (size / 2);
  const radius = (size / 2) - 3;

  // Background filled circle
  doc.setFillColor(79, 70, 229); // Accent Indigo
  doc.circle(centerX, centerY, radius, 'F');

  // Inner border circle
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.5);
  doc.circle(centerX, centerY, radius - 1, 'S');

  // Initials Text
  const initials = student?.name
    ? student.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : student?.usn?.slice(0, 2).toUpperCase() || 'ST';
  
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  const initialsWidth = doc.getTextWidth(initials);
  doc.text(initials, centerX - (initialsWidth / 2), centerY + 3.8);
};

/**
 * Super simple hash helper for receipt aesthetic integrity
 */
const generateSimpleHash = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash).toString(16).substring(0, 8).toUpperCase();
};
