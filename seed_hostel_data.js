import { Client, Databases, ID, Query } from 'node-appwrite';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const appwriteClient = new Client()
    .setEndpoint('https://nyc.cloud.appwrite.io/v1')
    .setProject('6a084d8900251e5c0f6e')
    .setKey(process.env.APPWRITE_API_KEY || 'standard_c7dff7481bb2f7982c52d1ddb8b45de44d5ee3eae0b79b0733544b309e48835263ad18f68a8dede36f3708947185958e019a0b6854d4945b801d99350fa65d75a2a7c3cf0667530ac2bbfafb822c87dbd350b738d8a1975c993e7a5f42672a91bd254e5a3ff82ae2cc6e4009707d99ebb7c6e9bc5b99818d82648421af2c1e50');

const databases = new Databases(appwriteClient);
const DATABASE_ID = '6a084e9b00061aea385a';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://wxzkubekkeewbdajotxf.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_qKMEdaw9HcHuK842v5dyfA_TaeUKO8d';
const supabase = createClient(supabaseUrl, supabaseKey);

const hashPassword = (pwd) => crypto.createHash('sha256').update(pwd).digest('hex');

async function seed() {
  console.log("Seeding hostel data...");

  // 1. Seed Wardens
  const wardens = [
    {
      username: 'boys_warden',
      password: hashPassword('boys_warden'),
      hostel_type: 'boys',
      assigned_block: 'Block A'
    },
    {
      username: 'girls_warden',
      password: hashPassword('girls_warden'),
      hostel_type: 'girls',
      assigned_block: 'Block B'
    }
  ];

  for (const w of wardens) {
    try {
      const existing = await databases.listDocuments(DATABASE_ID, 'hostelUsers', [
        Query.equal('username', w.username)
      ]);
      if (existing.documents.length === 0) {
        await databases.createDocument(DATABASE_ID, 'hostelUsers', ID.unique(), {
          warden_id: ID.unique(),
          username: w.username,
          password: w.password,
          hostel_type: w.hostel_type,
          assigned_block: w.assigned_block
        });
        console.log(`Seeded warden: ${w.username}`);
      } else {
        console.log(`Warden ${w.username} already exists`);
      }
    } catch (err) {
      console.error(`Error seeding warden ${w.username}:`, err.message);
    }
  }

  // 2. Seed Rooms
  const roomTypes = [
    { type: 'Single Room', capacity: 1, attached: true, ac: true, desc: 'Premium single occupant room with study desk and AC.' },
    { type: '2 Sharing', capacity: 2, attached: true, ac: true, desc: 'Premium double occupancy room with attached washroom.' },
    { type: '3 Sharing', capacity: 3, attached: true, ac: false, desc: 'Spacious triple occupancy room with individual lockers.' },
    { type: '4 Sharing', capacity: 4, attached: false, ac: false, desc: 'Quadruple sharing standard room with study setup.' }
  ];

  const types = ['boys', 'girls'];
  for (const hostelType of types) {
    for (let floor = 1; floor <= 2; floor++) {
      for (let rNum = 1; rNum <= 4; rNum++) {
        const roomNumber = `${floor}0${rNum}`;
        const config = roomTypes[rNum - 1]; // map room index to type
        const room_id = `${hostelType}_room_${roomNumber}`;

        try {
          const existing = await databases.listDocuments(DATABASE_ID, 'hostelRooms', [
            Query.equal('room_number', roomNumber),
            Query.equal('hostel_type', hostelType)
          ]);
          if (existing.documents.length === 0) {
            await databases.createDocument(DATABASE_ID, 'hostelRooms', room_id, {
              room_id,
              room_number: roomNumber,
              room_type: config.type,
              hostel_type: hostelType,
              floor: `${floor}nd Floor`,
              capacity: config.capacity,
              occupied_count: 0,
              availability_status: 'Available',
              attached_bathroom: config.attached,
              ac_available: config.ac,
              description: config.desc
            });
            console.log(`Seeded room ${roomNumber} for ${hostelType}`);

            // Room images mapping
            let imgUrl = '';
            if (config.capacity === 1) imgUrl = 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?q=80&w=600';
            else if (config.capacity === 2) imgUrl = 'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?q=80&w=600';
            else if (config.capacity === 3) imgUrl = 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=600';
            else imgUrl = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=600';

            await databases.createDocument(DATABASE_ID, 'hostelRoomImages', ID.unique(), {
              image_id: ID.unique(),
              room_id,
              image_url: imgUrl
            });
          } else {
            console.log(`Room ${roomNumber} for ${hostelType} already exists`);
          }
        } catch (err) {
          console.error(`Error seeding room ${roomNumber}:`, err.message);
        }
      }
    }
  }

  // 3. Seed Notices / Rule Books
  const notices = [
    {
      title: 'Curfew & Entry Guidelines 2026',
      content: 'Strict curfew at 9:30 PM. All students must register entries using biometric scanner at main gate.',
      is_emergency: true,
      hostel_type: 'boys'
    },
    {
      title: 'Curfew & Entry Guidelines 2026',
      content: 'Strict curfew at 8:30 PM. In-campus movements locked beyond 9:00 PM.',
      is_emergency: true,
      hostel_type: 'girls'
    },
    {
      title: 'Mess Menu Refinement Feedback',
      content: 'Warden has updated the weekly mess calendar. Constructive suggestions can be posted in the chat rooms.',
      is_emergency: false,
      hostel_type: 'boys'
    },
    {
      title: 'Mess Menu Refinement Feedback',
      content: 'Warden has updated the weekly mess menu. Constructive suggestions can be posted in the chat rooms.',
      is_emergency: false,
      hostel_type: 'girls'
    }
  ];

  for (const n of notices) {
    try {
      const existing = await databases.listDocuments(DATABASE_ID, 'hostelNotices', [
        Query.equal('title', n.title),
        Query.equal('hostel_type', n.hostel_type)
      ]);
      if (existing.documents.length === 0) {
        await databases.createDocument(DATABASE_ID, 'hostelNotices', ID.unique(), {
          notice_id: ID.unique(),
          title: n.title,
          content: n.content,
          is_emergency: n.is_emergency,
          hostel_type: n.hostel_type,
          pdf_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', // standard dummy pdf
          createdAt: new Date().toISOString()
        });
        console.log(`Seeded notice: ${n.title} for ${n.hostel_type}`);
      }
    } catch (err) {
      console.error('Error seeding notice:', err.message);
    }
  }

  // 4. Update Melroy Almeida to be Hostelite
  try {
    const studentsRes = await databases.listDocuments(DATABASE_ID, 'students', [
      Query.equal('email', '4so24cs128@campustwin.edu')
    ]);
    if (studentsRes.documents.length > 0) {
      const melroy = studentsRes.documents[0];
      const uid = melroy.uid;

      // Update in Appwrite
      await databases.updateDocument(DATABASE_ID, 'students', melroy.$id, {
        gender: 'male',
        hostel_type: 'boys'
      });
      console.log("Updated Melroy in Appwrite students");

      // Update in Supabase
      const { error: sbError } = await supabase
        .from('student_profiles')
        .update({
          is_hostelite: true
        })
        .eq('id', uid);
      if (sbError) {
        console.error("Failed to update Supabase profile:", sbError.message);
      } else {
        console.log("Successfully synced Melroy to is_hostelite = true in Supabase SQL!");
      }

      // Add a mock bill for Melroy
      const billsRes = await databases.listDocuments(DATABASE_ID, 'hostelBills', [
        Query.equal('student_id', uid)
      ]);
      if (billsRes.documents.length === 0) {
        await databases.createDocument(DATABASE_ID, 'hostelBills', ID.unique(), {
          bill_id: ID.unique(),
          student_id: uid,
          amount: 45000,
          due_date: '2026-06-15',
          status: 'unpaid',
          billing_month: 'Semester Fee (Even Sem 2026)',
          hostel_type: 'boys',
          createdAt: new Date().toISOString()
        });
        console.log("Generated mock unpaid bill of 45,000 for Melroy");
      }
    } else {
      console.warn("Melroy account (4so24cs128@campustwin.edu) not found in students database collection.");
    }
  } catch (err) {
    console.error("Failed to update test student:", err.message);
  }

  // 5. Seed Polls
  const polls = [
    {
      poll_id: 'boys_poll_dinner_time',
      question: 'What time do you prefer for dinner in the mess?',
      options: JSON.stringify(["7:30 PM", "8:00 PM", "8:30 PM"]),
      votes: JSON.stringify({"0": 10, "1": 15, "2": 5}),
      voted_users: JSON.stringify([]),
      hostel_type: 'boys',
      is_active: true,
      createdAt: new Date().toISOString()
    },
    {
      poll_id: 'girls_poll_sports_day',
      question: 'Which indoor sport should we add to the common room?',
      options: JSON.stringify(["Table Tennis", "Foosball", "Carrom Board"]),
      votes: JSON.stringify({"0": 18, "1": 8, "2": 14}),
      voted_users: JSON.stringify([]),
      hostel_type: 'girls',
      is_active: true,
      createdAt: new Date().toISOString()
    }
  ];

  for (const p of polls) {
    try {
      const existing = await databases.listDocuments(DATABASE_ID, 'hostelPolls', [
        Query.equal('poll_id', p.poll_id)
      ]);
      if (existing.documents.length === 0) {
        await databases.createDocument(DATABASE_ID, 'hostelPolls', p.poll_id, p);
        console.log(`Seeded poll: ${p.poll_id}`);
      } else {
        console.log(`Poll ${p.poll_id} already exists`);
      }
    } catch (err) {
      console.error(`Error seeding poll ${p.poll_id}:`, err.message);
    }
  }

  // 6. Seed Helplines
  const helplines = [
    {
      helpline_id: 'boys_helpline_desk',
      label: 'Boys Block Office / Security Desk',
      phone: '+91 98765 43210',
      email: 'boys.hostel@campustwin.edu',
      hostel_type: 'boys',
      createdAt: new Date().toISOString()
    },
    {
      helpline_id: 'boys_helpline_clinic',
      label: 'College Campus Health Clinic (24x7)',
      phone: '+91 98765 43219',
      email: 'health.clinic@campustwin.edu',
      hostel_type: 'boys',
      createdAt: new Date().toISOString()
    },
    {
      helpline_id: 'boys_helpline_ambulance',
      label: 'Campus Ambulance Emergency Hotline',
      phone: '+91 98765 43220',
      email: 'ambulance@campustwin.edu',
      hostel_type: 'boys',
      createdAt: new Date().toISOString()
    },
    {
      helpline_id: 'girls_helpline_desk',
      label: 'Girls Block Office / Security Desk',
      phone: '+91 98765 43211',
      email: 'girls.hostel@campustwin.edu',
      hostel_type: 'girls',
      createdAt: new Date().toISOString()
    },
    {
      helpline_id: 'girls_helpline_clinic',
      label: 'College Campus Health Clinic (24x7)',
      phone: '+91 98765 43219',
      email: 'health.clinic@campustwin.edu',
      hostel_type: 'girls',
      createdAt: new Date().toISOString()
    },
    {
      helpline_id: 'girls_helpline_ambulance',
      label: 'Campus Ambulance Emergency Hotline',
      phone: '+91 98765 43220',
      email: 'ambulance@campustwin.edu',
      hostel_type: 'girls',
      createdAt: new Date().toISOString()
    }
  ];

  for (const h of helplines) {
    try {
      const existing = await databases.listDocuments(DATABASE_ID, 'hostelHelplines', [
        Query.equal('helpline_id', h.helpline_id)
      ]);
      if (existing.documents.length === 0) {
        await databases.createDocument(DATABASE_ID, 'hostelHelplines', h.helpline_id, h);
        console.log(`Seeded helpline: ${h.helpline_id}`);
      } else {
        console.log(`Helpline ${h.helpline_id} already exists`);
      }
    } catch (err) {
      console.error(`Error seeding helpline ${h.helpline_id}:`, err.message);
    }
  }

  console.log("Seeding complete!");
}

seed();
