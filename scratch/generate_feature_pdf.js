import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

// Define target PDF path in the project root
const pdfPath = path.resolve('Campus_Twin_Features_Report.pdf');
console.log(`Generating Expanded PDF at: ${pdfPath}`);

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
   .fontSize(13)
   .font('Helvetica')
   .text('Unified Digital College ERP System — Complete Features Summary Report', { lineGap: 6 });

doc.fillColor(MUTED)
   .fontSize(9)
   .text(`Generated on: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}  |  Total Documented Features: 100`);

doc.moveDown(0.8);
doc.strokeColor(LINE_COLOR).lineWidth(1).moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
doc.moveDown(1.2);

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
     .fontSize(10)
     .text(title.toUpperCase(), 60, startY + 6);
     
  doc.y = startY + 30; // Set y coordinate past the banner
}

// Helper for Feature Entry
let currentSNo = 1;
function addFeatureRow(name, desc, difficulty) {
  // Check if we need to wrap to the next page before drawing
  if (doc.y > doc.page.height - 100) {
    doc.addPage();
    doc.y = 60; // reset y on new page
  }

  const startY = doc.y;
  
  // Row container background on alternate rows
  if (currentSNo % 2 === 0) {
    doc.rect(50, startY - 4, doc.page.width - 100, 48).fill('#f8fafc');
  }

  // Draw S.No.
  doc.fillColor(DARK)
     .font('Helvetica-Bold')
     .fontSize(9.5)
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
     .fontSize(9)
     .text(desc, 85, startY + 14, { width: doc.page.width - 205, lineGap: 2 });

  // Draw bottom light border
  doc.strokeColor('#f1f5f9')
     .lineWidth(0.8)
     .moveTo(50, startY + 40)
     .lineTo(doc.page.width - 50, startY + 40)
     .stroke();

  doc.y = startY + 44; // Set next y coordinate
  currentSNo++;
}

// ======================== CATEGORY 1: SECURITY & USER MANAGEMENT ========================
addSectionTitle('1. Core Security & Authentication Modules', PRIMARY);

addFeatureRow(
  'Secure Appwrite Authentication',
  'Unified login portal using secure Appwrite session creation for students, teachers, mentors, and administrators.',
  'Major'
);
addFeatureRow(
  'First-Time Login Force Password Change',
  'Forces newly created users to update their password immediately upon their first login to ensure account security.',
  'Major'
);
addFeatureRow(
  'Forgot Password OTP Verification Flow',
  'A multi-step recovery flow allowing users to reset their forgotten passwords using a secure 6-digit email verification code.',
  'Major'
);
addFeatureRow(
  'Secure Account Deletion Serverless API',
  'A Netlify serverless function that deletes user profiles and database records securely without exposing credentials.',
  'Major'
);
addFeatureRow(
  'Multi-Role Route Authorization (Private Routes)',
  'Strict UI-level and route-level authorization restricting pages based on user roles (Student, Teacher, Mentor, Admin).',
  'Major'
);
addFeatureRow(
  'Session Persistence Manager',
  'Automatic theme and login session conservation integrated with browser local storage.',
  'Simple'
);
addFeatureRow(
  'Interactive OTP Demo Mode Simulation',
  'Falls back to displaying the generated OTP code directly on the UI when SMTP services are unconfigured, enabling seamless developer testing.',
  'Simple'
);
addFeatureRow(
  'Global Toast Alerts Integration',
  'Integrated React Hot Toast for displaying beautiful, non-intrusive status notifications and warning messages.',
  'Simple'
);
addFeatureRow(
  'Role-Based Redirect Engine',
  'Validates login profiles and automatically redirects users to their respective home dashboards upon entering the domain.',
  'Simple'
);

// ======================== CATEGORY 2: STUDENT PORTAL ========================
addSectionTitle('2. Student Portal Features', PRIMARY);

addFeatureRow(
  'Interactive Student Home Dashboard',
  'A grid-based dashboard presenting current day lectures, quick statistics, announcements, and navigation widgets.',
  'Major'
);
addFeatureRow(
  'Interactive Timetable Grid Viewer',
  'Displays class timetables with customizable colors and clean layout representations.',
  'Major'
);
addFeatureRow(
  'Semester Course Registration System',
  'Allows students to register for course packages and electives based on branch and semester restrictions.',
  'Major'
);
addFeatureRow(
  'AICTE Activity Points Tracker',
  'Comprehensive panel for students to log AICTE activity points and upload supporting certificates.',
  'Major'
);
addFeatureRow(
  'Subject-Wise Internal Marks Sheet',
  'Displays marks scored in internal assessments, test series, and practical evaluations.',
  'Minor'
);
addFeatureRow(
  'Academic Marks Card PDF Exporter',
  'Generates and exports official university marks cards in PDF format directly from the browser.',
  'Minor'
);
addFeatureRow(
  'Interactive Calendar of Events',
  'A visual timeline presenting academic cycles, holidays, events, and examination dates.',
  'Minor'
);
addFeatureRow(
  'Attendance Percentage Progress Bar',
  'Displays overall and subject-wise attendance with warning indicators if it falls below 75%.',
  'Minor'
);
addFeatureRow(
  'Real-Time Chat Notification Feed',
  'Displays a count of unread messages and updates from the class group chat rooms.',
  'Simple'
);
addFeatureRow(
  'Direct Portal Profile View',
  'Displays student roll number, USN, division, and official department records.',
  'Simple'
);
addFeatureRow(
  'Class Announcement Bulletin Board',
  'A clean notification panel highlighting warnings, notices, and test schedules.',
  'Simple'
);
addFeatureRow(
  'Live Session Highlight',
  'Detects the current time and highlights the ongoing lecture slot in the student dashboard.',
  'Simple'
);
addFeatureRow(
  'PWA Theme Switcher Integration',
  'Allows students to toggle between clean Light Mode and elegant Dark Mode themes.',
  'Simple'
);
addFeatureRow(
  'LinkedIn Official Profile Redirect',
  'Sidebar quick-link redirecting students to their college official LinkedIn pages.',
  'Simple'
);
addFeatureRow(
  'Official College Website External Redirect',
  'Sidebar quick-link redirecting students to the main institutional website.',
  'Simple'
);

// ======================== CATEGORY 3: COMPLAINT BOX & REGULATORY LINKS ========================
addSectionTitle('3. Complaint Box & Anti-Ragging Hotline', SECONDARY);

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
  'Direct access link to government drug abuse prevention databases and local helplines.',
  'Simple'
);

// ======================== CATEGORY 4: TEACHER & FACULTY PORTAL ========================
addSectionTitle('4. Teacher & Faculty Portal Features', PRIMARY);

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

// ======================== CATEGORY 5: MENTOR & ADVISOR PORTAL ========================
addSectionTitle('5. Mentor & Advisor Portal Features', PRIMARY);

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

// ======================== CATEGORY 6: ADMIN & ENTERPRISE ERP ========================
addSectionTitle('6. Admin ERP & Campus Configurations', PRIMARY);

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

// ======================== CATEGORY 7: HOSTEL ERP MODULE ========================
addSectionTitle('7. Hostel Management System (ERP)', SECONDARY);

addFeatureRow(
  'Hostel Selection Gateway',
  'Allows logging into either Boys\' or Girls\' hostel divisions based on student roles.',
  'Major'
);
addFeatureRow(
  'Warden Administration Portal',
  'A full dashboard for hostel wardens to allocate rooms, view bills, and approve leave outpasses.',
  'Major'
);
addFeatureRow(
  'Warden Room Allocation Board',
  'A visual manager for hostel room occupancy, detailing room statuses and resident USNs.',
  'Major'
);
addFeatureRow(
  'Student Hostel Outpass & Leave Form',
  'Enables students to submit leave applications (outpasses) specifying destination and dates.',
  'Major'
);
addFeatureRow(
  'Warden Leave Request Approval Queue',
  'Allows wardens to inspect student outpasses and approve or reject them with feedback.',
  'Major'
);
addFeatureRow(
  'Automated Monthly Bill Generator',
  'Runs a monthly batch calculation to generate mess, rent, and utility bills for residents.',
  'Minor'
);
addFeatureRow(
  'Resident Fee Tracker & Payment status',
  'Displays resident payment history, showing paid, pending, or overdue hostel fees.',
  'Minor'
);
addFeatureRow(
  'Hostel Grievance Board',
  'Allows residents to lodge complaints regarding rooms, Wi-Fi, electricity, or mess quality.',
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

// ======================== CATEGORY 8: PLACEMENT PORTAL ========================
addSectionTitle('8. Placement & Career Portal', PRIMARY);

addFeatureRow(
  'Placement Selection Gateway',
  'Enables logging in as either student applicant or Placement Officer administrator.',
  'Major'
);
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

// ======================== CATEGORY 9: AI ASSISTANT & CHATBOT ========================
addSectionTitle('9. Copilot AI Assistant & Chatbot Widget', SECONDARY);

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

// ======================== CATEGORY 10: CHAT, PWA & GENERAL UTILITIES ========================
addSectionTitle('10. Chat, PWA & ERP Utilities', MUTED);

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
  'Anti-Screenshot Secure Document Shield',
  'Protects sensitive files inside the Document Cabinet from screenshots using instant window blur filters, print blockers, and disabled context menus.',
  'Major'
);
addFeatureRow(
  'ERP System Maintenance Mode Screen',
  'Blocks non-administrative access and displays a clean status screen during ERP updates.',
  'Minor'
);
addFeatureRow(
  'Initials-Based Avatar Fallback Generator',
  'Automatically renders initials placeholders for user profiles without uploaded photos.',
  'Simple'
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
     .text(`Campus Twin — Complete System Features Summary Report  |  Page ${i + 1} of ${totalPages}`, 50, doc.page.height - 32, { align: 'center' });
}

doc.end();

writeStream.on('finish', () => {
  console.log('Expanded PDF successfully generated!');
});
