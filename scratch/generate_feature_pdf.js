import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

// Define target PDF path in the project root
const pdfPath = path.resolve('Campus_Twin_Features_Report.pdf');
console.log(`Generating Thorough PDF at: ${pdfPath}`);

const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 50, bottom: 50, left: 50, right: 50 },
  bufferPages: true
});

const writeStream = fs.createWriteStream(pdfPath);
doc.pipe(writeStream);

// Primary colors
const PRIMARY = '#1e3a8a';   // Deep Blue
const SECONDARY = '#0f766e'; // Teal
const DARK = '#1e293b';      // Slate Dark
const LIGHT = '#f8fafc';     // Light Gray/Slate
const MUTED = '#64748b';     // Slate Muted
const LINE_COLOR = '#e2e8f0';

// Title Header
doc.rect(50, 45, doc.page.width - 100, 4).fill(PRIMARY);
doc.moveDown(1.5);

doc.fillColor(PRIMARY)
   .font('Helvetica-Bold')
   .fontSize(22)
   .text('CAMPUS TWIN', { tracking: 1 });

doc.fillColor(DARK)
   .fontSize(12)
   .font('Helvetica')
   .text('Unified Digital College ERP System — Complete System Blueprint & Features Summary', { lineGap: 4 });

doc.fillColor(MUTED)
   .fontSize(8.5)
   .text(`Generated on: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}  |  Thorough Description Mode  |  Total Documented Features: 86`);

doc.moveDown(0.8);
doc.strokeColor(LINE_COLOR).lineWidth(1).moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
doc.moveDown(1.2);

// Page 1 Welcome & Architecture highlights
doc.fillColor(DARK)
   .font('Helvetica-Bold')
   .fontSize(13)
   .text('Executive System Architecture Blueprint', { lineGap: 6 });

doc.fillColor(DARK)
   .font('Helvetica')
   .fontSize(9.5)
   .text('This document outlines the software blueprint and features summary of Campus Twin, a comprehensive educational resource planning (ERP) platform. Built utilizing client-side encryption, WebSockets communication, Appwrite databases, and custom algorithms, the system operates across student, faculty, mentor, and administrator modules to create a secure, real-time environment. Special emphasis is placed on security protocols (anti-screenshot filters, AES-256 client-side encryption) and advanced mathematical solvers (timetable constraint solver).', { lineGap: 4 });

doc.moveDown(1);
doc.strokeColor(LINE_COLOR).lineWidth(0.5).moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
doc.moveDown(1);

// Helper for Section Titles
function addSectionTitle(title, color) {
  // Check if we need to wrap before adding a section header
  if (doc.y > doc.page.height - 120) {
    doc.addPage();
    doc.y = 60;
  }
  
  doc.moveDown(1);
  const startY = doc.y;
  
  // Clean header background banner
  doc.rect(50, startY, doc.page.width - 100, 22).fill(color);
  
  doc.fillColor('#ffffff')
     .font('Helvetica-Bold')
     .fontSize(9.5)
     .text(title.toUpperCase(), 60, startY + 6);
     
  doc.y = startY + 32; // Set y coordinate past the banner
}

// Helper for Feature Entry with Thorough multi-line wrapping checks
let currentSNo = 1;
function addFeatureRow(name, desc, difficulty) {
  // Estimate height: name (12pt), badge (12pt), desc (calculated wrap height)
  // PDFKit text height estimation: roughly font_size * line_count
  const textOptions = { width: doc.page.width - 205, lineGap: 2.5 };
  const descHeight = doc.heightOfString(desc, textOptions);
  const totalRowHeight = descHeight + 24; // padding for name, border, etc.

  // Check if we need to wrap to the next page before drawing
  if (doc.y + totalRowHeight > doc.page.height - 70) {
    doc.addPage();
    doc.y = 60; // reset y on new page
  }

  const startY = doc.y;
  
  // Row container background on alternate rows
  if (currentSNo % 2 === 0) {
    doc.rect(50, startY - 4, doc.page.width - 100, totalRowHeight + 4).fill('#f8fafc');
  }

  // Draw S.No.
  doc.fillColor(DARK)
     .font('Helvetica-Bold')
     .fontSize(9)
     .text(`${currentSNo}.`, 60, startY);

  // Draw Feature Name
  doc.fillColor(PRIMARY)
     .font('Helvetica-Bold')
     .fontSize(9.5)
     .text(name, 85, startY);

  // Draw Difficulty Badge
  let badgeColor = SECONDARY;
  if (difficulty === 'Major') badgeColor = PRIMARY;
  if (difficulty === 'Simple') badgeColor = MUTED;
  
  doc.rect(doc.page.width - 110, startY - 2, 60, 13).fill(badgeColor);
  doc.fillColor('#ffffff')
     .font('Helvetica-Bold')
     .fontSize(7.5)
     .text(difficulty, doc.page.width - 110, startY + 1, { width: 60, align: 'center' });

  // Draw Description
  doc.fillColor(DARK)
     .font('Helvetica')
     .fontSize(8.5)
     .text(desc, 85, startY + 14, textOptions);

  // Draw bottom light border
  doc.strokeColor('#f1f5f9')
     .lineWidth(0.8)
     .moveTo(50, startY + totalRowHeight)
     .lineTo(doc.page.width - 50, startY + totalRowHeight)
     .stroke();

  doc.y = startY + totalRowHeight + 6; // Set next y coordinate
  currentSNo++;
}

// ======================== CATEGORY 1: SECURITY & USER MANAGEMENT ========================
addSectionTitle('1. Core Security, Cryptography & User Audits', PRIMARY);

addFeatureRow(
  'Secure Appwrite Authentication',
  'Protects database entry using Appwrite Session Creation. It validates user USN or Email alongside encrypted passwords, and generates session cookies to prevent session-jacking, verifying access permissions on every route navigation.',
  'Major'
);
addFeatureRow(
  'First-Time Password Force Reset',
  'Secures new accounts by checking if userRoles.must_change_password is true. If true, the system blocks dashboard access and forces the user to choose a new, strong password, removing their initial password record from database logs upon submission.',
  'Major'
);
addFeatureRow(
  'Forgot Password OTP Recovery Flow',
  'Sends a secure, random 6-digit verification code to the user\'s registered email address using Nodemailer SMTP netlify functions. The system enforces a 5-minute expiry timer and checks the entered OTP before unlocking the password update panel.',
  'Major'
);
addFeatureRow(
  'Secure Account Deletion Serverless API',
  'Protects system security by performing user profile deletions through a netlify serverless function. This function calls admin APIs to remove both database profiles and authentication records, preventing raw API key exposures in front-end files.',
  'Major'
);
addFeatureRow(
  'Multi-Role Route Authorization (Private Routes)',
  'Restricts page access by wrapping pages in a client-side PrivateRoute component. This component reads the userProfile state and redirects unauthorized accounts (e.g. students trying to access admin configurations) back to their designated role dashboard.',
  'Major'
);
addFeatureRow(
  'Session Persistence Manager',
  'Uses browser local storage to preserve active user theme choices and authentication session references, ensuring that users do not need to re-login upon refreshing or closing the browser.',
  'Simple'
);
addFeatureRow(
  'Interactive OTP Demo Mode Simulation',
  'Detects when local SMTP credentials (SMTP_EMAIL/SMTP_PASSWORD) are not configured, and automatically displays the generated OTP code directly on the web interface in a bright blue banner, enabling developers to test logins without an email server.',
  'Simple'
);
addFeatureRow(
  'Global Toast Alert Prompts',
  'Integrates React Hot Toast to display real-time feedback animations during asynchronous database tasks (loading spinners, success logs, and error warnings) for a premium user feel.',
  'Simple'
);
addFeatureRow(
  'Role-Based Redirect Engine',
  'Evaluates the userProfile object immediately upon loading the home route and performs navigation redirects, ensuring students land on /student, faculty on /teacher, and super-admins on /admin.',
  'Simple'
);

// ======================== CATEGORY 2: THE SECURE DOCUMENT CABINET ========================
addSectionTitle('2. Document Cabinet with Secure Anti-Screenshot Suite', SECONDARY);

addFeatureRow(
  'Secure Document Locker Panel',
  'Provides students, mentors, and administrators with an encrypted cloud cabinet to upload and organize files (like OD certificates, fee receipts, or medical proofs) using folder hierarchies.',
  'Major'
);
addFeatureRow(
  'AES-GCM Client-Side Encryption',
  'Encrypts document names, storage URLs, and folder names directly on the user\'s browser using AES-GCM before saving them to Appwrite. This prevents database administrators or host servers from reading file details in plaintext.',
  'Major'
);
addFeatureRow(
  'Anti-Screenshot secure document shield',
  'Tracks browser window focus. The moment the user clicks away, opens external capture tools (like Snipping Tool or Snagit), or loses tab focus, the system applies a CSS body blur filter: filter: blur(60px) brightness(0) !important; background: #000; turning the screen pitch-black and rendering any screenshot blank/unreadable.',
  'Major'
);
addFeatureRow(
  'Print Blocker CSS overrides',
  'Injects media queries (@media print { body { display: none !important; } }) that hide the page contents entirely if a print action (Ctrl+P) is triggered, preventing users from printing or printing-to-PDF sensitive documents.',
  'Minor'
);
addFeatureRow(
  'Right-Click and Inspector Blocker',
  'Disables browser context menus on the documents page (onContextMenu) to prevent users from right-clicking to "Inspect Element," downloading thumbnail assets, or looking up encrypted CDN links.',
  'Simple'
);
addFeatureRow(
  'Clipboard Copy Prevention',
  'Disables clipboard copy events (onCopy) and text selection (userSelect: none) on document elements, popping up a security toast alert if text theft is attempted.',
  'Simple'
);

// ======================== CATEGORY 3: ACADEMICS & STUDENT PORTAL ========================
addSectionTitle('3. Student Portal & Academics Module', PRIMARY);

addFeatureRow(
  'Student Dashboard Hub',
  'A dashboard page mapping out a student\'s daily schedule, highlight banners of current lectures, notifications feed, and quick link cards to academics or portals.',
  'Major'
);
addFeatureRow(
  'Interactive Timetable Grid',
  'Fetches the class timetable database and maps it into a weekly schedule grid, highlighting the ongoing lecture based on the user\'s system clock.',
  'Major'
);
addFeatureRow(
  'Semester Course Registration System',
  'Allows students to register for course packages and electives based on branch and semester restrictions.',
  'Major'
);
addFeatureRow(
  'AICTE Activity Points Log',
  'Allows students to log activities (seminars, sports, NGO works) to earn mandatory university AICTE points, with file upload capabilities for certificate verification.',
  'Major'
);
addFeatureRow(
  'Attendance Percentage Tracker',
  'Fetches classroom logs to display overall and subject-wise attendance percentages, with color-coded bars that turn amber/red if attendance falls below the 75% limit.',
  'Minor'
);
addFeatureRow(
  'Digital Marks Card PDF Exporter',
  'Takes student academic marks cards and formats them into a download-ready official PDF report, allowing students to print grades directly.',
  'Minor'
);
addFeatureRow(
  'College Events Timeline Calendar',
  'Displays academic cycles, workshops, exams, and holidays posted by admins in an interactive, visual timeline layout.',
  'Minor'
);
addFeatureRow(
  'Class Announcement Bulletin',
  'A notification panel highlighting warnings, notices, and test schedules.',
  'Simple'
);
addFeatureRow(
  'LinkedIn Official Profile Redirect',
  'A quick-link sidebar shortcut to the institutional LinkedIn profile for student convenience.',
  'Simple'
);
addFeatureRow(
  'College Website Quick Redirect',
  'A quick-link sidebar shortcut to the main university website.',
  'Simple'
);

// ======================== CATEGORY 4: TEACHER CLASSROOM CONTROL ========================
addSectionTitle('4. Teacher Classroom Management', PRIMARY);

addFeatureRow(
  'Teacher Personal Dashboard',
  'A dedicated layout showing assigned subjects, ongoing schedules, and quick portal links.',
  'Major'
);
addFeatureRow(
  'Class Attendance Logging Interface',
  'A checklist grid allowing teachers to select a branch, class, and mark students present or absent.',
  'Major'
);
addFeatureRow(
  'Student Marks Upload Board',
  'Enables teachers to select tests, input grades, and publish scores to the student marks dashboard.',
  'Major'
);
addFeatureRow(
  'Personal Leave Request Form',
  'Allows teachers to apply for casual, medical, or official leaves directly to branch heads.',
  'Minor'
);
addFeatureRow(
  'Leave Status Tracking History',
  'Displays previous leave requests, approval notes, and statuses (Approved/Pending/Rejected).',
  'Minor'
);
addFeatureRow(
  'Teacher Schedule Planner',
  'An agenda view mapping out a teacher\'s weekly lecture hours and lab allocations.',
  'Minor'
);
addFeatureRow(
  'Interactive Classroom Chat Room Access',
  'Allows faculty members to moderate and post in class chat rooms for their subjects.',
  'Minor'
);
addFeatureRow(
  'Department Complaint Log Access',
  'Enables teachers to view complaints raised by students assigned to their courses.',
  'Simple'
);

// ======================== CATEGORY 5: MENTOR & ADVISOR AUDIT ========================
addSectionTitle('5. Mentor & Advisor Auditing Tools', PRIMARY);

addFeatureRow(
  'Mentor Group Dashboard',
  'A dedicated workspace listing all mentees assigned to the faculty member.',
  'Major'
);
addFeatureRow(
  'Student Academic Profile Lookup',
  'A search system to inspect a mentee\'s full academic record, including GPA and marks cards.',
  'Major'
);
addFeatureRow(
  'AICTE Points Verification Queue',
  'Allows mentors to view certificates uploaded by their mentees and approve/reject points.',
  'Major'
);
addFeatureRow(
  'Mentee Attendance Auditor',
  'An analysis screen showing detailed student attendance summaries across all semesters.',
  'Minor'
);
addFeatureRow(
  'Unified Mentoring Record Book',
  'Allows advisors to log notes, review semester registrations, and maintain student histories.',
  'Minor'
);
addFeatureRow(
  'Exam History Audit Log',
  'Allows advisors to view previous backlog details, SGPA history, and student CGPA progress.',
  'Minor'
);
addFeatureRow(
  'Direct Mentor-Mentee Announcement Tool',
  'Sends notification feeds specifically to a mentor\'s assigned group of student users.',
  'Simple'
);

// ======================== CATEGORY 6: COMPLAINT BOX & HELPLINES ========================
addSectionTitle('6. Complaint Box & Anti-Ragging Hotline', SECONDARY);

addFeatureRow(
  'Anonymous Student Complaint Box',
  'Allows students to post grievance issues, submit feedback, or raise complaints directly to their mentors/admins.',
  'Major'
);
addFeatureRow(
  'Complaint Ticket Status Tracker',
  'A visual timeline representing whether a complaint is Open, In-Progress, or Resolved.',
  'Minor'
);
addFeatureRow(
  'Admin Complaint Resolver Interface',
  'Allows administrators to filter complaints by status, assign resolvers, and post closing feedback.',
  'Minor'
);
addFeatureRow(
  'Official Anti-Ragging Website Link',
  'Integrated national anti-ragging portal redirect link under the complaint box for safety.',
  'Simple'
);
addFeatureRow(
  'Institutional Drug Prevention Portal Link',
  'Direct access link to government drug abuse prevention databases and helplines.',
  'Simple'
);

// ======================== CATEGORY 7: CAMPUS ERP & AUTOMATION ========================
addSectionTitle('7. Institutional ERP & Automation configs', PRIMARY);

addFeatureRow(
  'AI-Assisted Automated Timetable Generator',
  'An intelligent scheduling engine that automatically calculates section timetables while avoiding clashes.',
  'Major'
);
addFeatureRow(
  'Curriculum & Subject Database Manager',
  'Enables admins to define course codes, names, credits, and lab integrated status.',
  'Major'
);
addFeatureRow(
  'User Account Creation Dashboard',
  'Enables adding student, teacher, or mentor logins, assigning their branch, division, and USN.',
  'Major'
);
addFeatureRow(
  'Branch Configuration Setup Panel',
  'Enables managing branches (e.g. CSE, ECE) and editing institutional metadata.',
  'Major'
);
addFeatureRow(
  'Class Configuration Setup Panel',
  'Enables configuring sections, semesters, advisors, mentors, and credit limits.',
  'Major'
);
addFeatureRow(
  'Dynamic Time Slot Manager',
  'Allows branch admins to customize timetable period start/end timings per class.',
  'Minor'
);
addFeatureRow(
  'Excel Bulk Student Importer (.xlsx)',
  'Allows importing student rosters in bulk using pre-formatted Excel sheets.',
  'Minor'
);
addFeatureRow(
  'Excel Blank Template Exporter',
  'Downloads clean Excel template sheets for bulk student roster preparation.',
  'Minor'
);
addFeatureRow(
  'Double-Click Timetable Preview Overrides',
  'Allows overriding generated timetable options by double-clicking cells before database save.',
  'Minor'
);
addFeatureRow(
  'Zero-Credit Subject Configuration',
  'Fully supports zero-credit (audit/mandatory non-credit) subjects in curriculum setup.',
  'Minor'
);
addFeatureRow(
  'Copy Class ID Clipboard tool',
  'A quick-action button in Class Management to copy Appwrite Class IDs instantly.',
  'Simple'
);
addFeatureRow(
  'Event & Announcement Publisher',
  'Allows posting college-wide alerts, test sheets, or event listings to the bulletin.',
  'Simple'
);

// ======================== CATEGORY 8: HOSTEL MANAGEMENT SYSTEM ========================
addSectionTitle('8. Hostel ERP (Universal Boarding Management System)', SECONDARY);

addFeatureRow(
  'Universal Boarding Architecture',
  'Built with a modular database structure isolated from the university core. This system can be adopted by any residential complex, boarding school, hotel, or apartment booking system by swapping API keys.',
  'Major'
);
addFeatureRow(
  'Hostel Division Gateway',
  'A portal directory that splits user sessions into Boys\' Hostel or Girls\' Hostel databases based on gender mapping.',
  'Major'
);
addFeatureRow(
  'Warden Room Allocation Map',
  'A visual manager for hostel room occupancy, detailing room statuses, occupied beds, and resident USNs in real-time.',
  'Major'
);
addFeatureRow(
  'Student Hostel Outpass & Leave Form',
  'Enables students to submit leave applications (outpasses) specifying checkout times, checkout dates, destination, and emergency contact details.',
  'Major'
);
addFeatureRow(
  'Warden Leave Request Approval Queue',
  'Allows wardens to inspect student outpasses and approve or reject them with feedback, immediately changing the resident\'s checkout status.',
  'Major'
);
addFeatureRow(
  'Automated Monthly Bill Generator',
  'Runs a monthly batch calculation to generate mess, rent, and utility bills for residents based on check-in duration and utility coefficients.',
  'Minor'
);
addFeatureRow(
  'Resident Fee Tracker & Payment status',
  'Displays resident payment history, showing paid, pending, or overdue hostel fees for financial tracking.',
  'Minor'
);
addFeatureRow(
  'Hostel Grievance Board',
  'Allows residents to lodge complaints regarding rooms, Wi-Fi, electricity, or mess quality directly to the warden dashboard.',
  'Minor'
);
addFeatureRow(
  'Warden-Student Hostel Chat Rooms',
  'Real-time communication channels for wardens to post alerts and coordinate with residents.',
  'Minor'
);
addFeatureRow(
  'Hostel Notice Board & Regulations Viewer',
  'Publishes emergency warden alerts, rules, and timings directly to the student hostel feed.',
  'Simple'
);

// ======================== CATEGORY 9: CAREER & PLACEMENT PORTAL ========================
addSectionTitle('9. Career & Placement Portal', PRIMARY);

addFeatureRow(
  'Placement Officer Portal',
  'A control dashboard for managing campus drives, applicant lists, and job profiles.',
  'Major'
);
addFeatureRow(
  'Job Posting Board & Drive Creator',
  'Enables placement officers to post company details, salary CTC, roles, and eligibility.',
  'Major'
);
addFeatureRow(
  'Interactive Student Resume Builder',
  'An interactive editor for students to input skills, projects, and education to generate a CV.',
  'Major'
);
addFeatureRow(
  'Student Job Application Center',
  'Displays active campus drives matching eligibility criteria with a one-click apply button.',
  'Major'
);
addFeatureRow(
  'Resume PDF Exporter',
  'Generates a clean PDF formatting of the student\'s resume for campus placement purposes.',
  'Minor'
);
addFeatureRow(
  'Applicant Shortlist Tracker',
  'Displays students who applied for drives and allows shortlisting for interviews.',
  'Minor'
);
addFeatureRow(
  'Interview Calendar & Schedule Notifications',
  'Alerts candidates about drive rounds, written tests, and technical interview timings.',
  'Minor'
);
addFeatureRow(
  'Drive Candidate Excel Exporter',
  'Enables placement officers to export shortlisted students to an Excel sheet for HR teams.',
  'Minor'
);
addFeatureRow(
  'Placement Drive History',
  'A directory tracking previous companies visited, offers made, and student selections.',
  'Simple'
);

// ======================== CATEGORY 10: COPILOT AI ASSISTANT ========================
addSectionTitle('10. Copilot AI Assistant & WebSockets Chat', SECONDARY);

addFeatureRow(
  'Copilot AI Chatbot Widget',
  'A chatbot floating widget available across dashboards to assist with campus questions.',
  'Major'
);
addFeatureRow(
  'AI Text-to-Speech Voice Synthesis',
  'Allows the AI chatbot to read responses aloud using system voice synthesizers.',
  'Minor'
);
addFeatureRow(
  'AI Response Copy to Clipboard',
  'One-click button on each chatbot reply to instantly copy text responses.',
  'Simple'
);
addFeatureRow(
  'Floating Quick Assistant Panel',
  'A floating button that opens a beautiful modal chat overlay with one click.',
  'Simple'
);
addFeatureRow(
  'Real-Time Class Chat Rooms',
  'Real-time, WebSocket-based group messaging boards for every registered classroom section.',
  'Major'
);
addFeatureRow(
  'Official Documents Share & Approvals',
  'Allows students to share official docs (ODs, certificates) for approval by mentors.',
  'Major'
);
addFeatureRow(
  'ERP System Maintenance Mode Screen',
  'Blocks non-administrative access and displays a clean status screen during ERP updates.',
  'Minor'
);
addFeatureRow(
  'PWA Service Worker Offline Support',
  'Registers a service worker to cache pages, stylesheet assets, and index structures.',
  'Simple'
);
addFeatureRow(
  'Responsive Sidebar Layout',
  'A collapse-ready dashboard navigation sidebar optimized for mobile, tablet, and desktop.',
  'Simple'
);
addFeatureRow(
  'Timetable Touch Scroll Integration',
  'Allows responsive horizontal touch-swipe scrolling on mobile to view timetable columns.',
  'Simple'
);

// Footer & Page Numbers
const totalPages = doc.bufferedPageRange().count;
for (let i = 0; i < totalPages; i++) {
  doc.switchToPage(i);
  doc.strokeColor(LINE_COLOR).lineWidth(1).moveTo(50, doc.page.height - 40).lineTo(doc.page.width - 50, doc.page.height - 40).stroke();
  doc.fillColor(MUTED)
     .font('Helvetica')
     .fontSize(8)
     .text(`Campus Twin ERP  |  Universal Boarding ERP & Timetable CSP Solver  |  Page ${i + 1} of ${totalPages}`, 50, doc.page.height - 32, { align: 'center' });
}

doc.end();

writeStream.on('finish', () => {
  console.log('Detailed PDF successfully generated!');
});
