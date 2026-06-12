import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import {
  getAll, addDocument, deleteDocument, queryDocuments, addChangeLog, addNotification, getStudentsByClass
} from '../../appwrite/database';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';
import { Query } from 'appwrite';
import { 
  MdArrowBack, MdAutoAwesome, MdCheck, MdClose, MdEdit, MdRefresh, MdSave, MdWarning, MdInfo 
} from 'react-icons/md';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SEMESTERS = ['1st Semester', '2nd Semester', '3rd Semester', '4th Semester', '5th Semester', '6th Semester', '7th Semester', '8th Semester'];

const DEFAULT_SLOTS = [
  { label: '9:00 - 9:55',   start: '09:00', end: '09:55' },
  { label: '9:55 - 10:50',  start: '09:55', end: '10:50' },
  { label: '11:10 - 12:05', start: '11:10', end: '12:05' },
  { label: '12:05 - 1:00',  start: '12:05', end: '13:00' },
  { label: '2:00 - 3:00',   start: '14:00', end: '15:00' },
  { label: '3:00 - 4:00',   start: '15:00', end: '16:00' },
  { label: '4:00 - 5:00',   start: '16:00', end: '17:00' },
];

function formatTime(t24) {
  if (!t24) return '';
  const [hStr, mStr] = t24.split(':');
  let h = parseInt(hStr);
  const m = mStr || '00';
  if (h === 0) return `12:${m}`;
  if (h <= 12) return `${h}:${m}`;
  return `${h - 12}:${m}`;
}

function hashColor(str) {
  if (!str || str === 'Free') return 0;
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % 10;
}

export default function AutoGenerateTimetable() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const adminBranch = userProfile?.branch_id;

    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [saving, setSaving] = useState(false);

    // Custom time slots state
    const [slots, setSlots] = useState(DEFAULT_SLOTS);

    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
      const handleResize = () => setIsMobile(window.innerWidth < 768);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleSlotTimeChange = (idx, key, value) => {
      setSlots(prev => {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], [key]: value };
        const start = key === 'start' ? value : updated[idx].start;
        const end = key === 'end' ? value : updated[idx].end;
        updated[idx].label = `${formatTime(start)} - ${formatTime(end)}`;
        return updated;
      });
    };

    const handleRemoveSlot = (idx) => {
      setSlots(prev => prev.filter((_, i) => i !== idx));
    };

    const handleAddSlot = () => {
      setSlots(prev => {
        let nextStart = '17:00';
        let nextEnd = '18:00';
        if (prev.length > 0) {
          const lastSlot = prev[prev.length - 1];
          nextStart = lastSlot.end;
          const [h, m] = lastSlot.end.split(':').map(Number);
          nextEnd = `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        }
        return [...prev, { label: `${formatTime(nextStart)} - ${formatTime(nextEnd)}`, start: nextStart, end: nextEnd }];
      });
    };

  // Data states
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [allSubjects, setAllSubjects] = useState([]);
  const [allAllocations, setAllAllocations] = useState([]);

  // Selected parameters
  const [selectedSemester, setSelectedSemester] = useState('4th Semester');
  const [targetClasses, setTargetClasses] = useState([]);
  const [configuredSubjects, setConfiguredSubjects] = useState([]);

  // Solver states
  const [options, setOptions] = useState([]); // Array of 4 schedule grids
  const [activeOptionIdx, setActiveOptionIdx] = useState(0);
  const [previewClassId, setPreviewClassId] = useState('');
  
  // Prompt refinement states
  const [promptText, setPromptText] = useState('');
  const [promptConstraints, setPromptConstraints] = useState([]);

  // Manual cell override modal states
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideCell, setOverrideCell] = useState(null); // { day, slotIdx, classId }
  const [overrideForm, setOverrideForm] = useState({ subject: 'Free', teacher: '', room: '' });

  // Load initial data from database
  const loadDatabaseData = async () => {
    setLoading(true);
    try {
      const [classesData, teachersData, subjectsData, allocationsData] = await Promise.all([
        getAll('classes'),
        getAll('teachers'),
        getAll('subjects'),
        getAll('subjectAllocations')
      ]);

      // Filter classes for the admin's branch
      const branchClasses = classesData.filter(c => c.branch === adminBranch || c.branch_id === adminBranch);
      setClasses(branchClasses);

      // Filter teachers for the admin's branch
      const branchTeachers = teachersData.filter(t => t.branch_id === adminBranch || t.department === adminBranch);
      setTeachers(branchTeachers);

      // Filter subjects for the admin's branch
      const branchSubjects = subjectsData.filter(s => s.branch_id === adminBranch);
      setAllSubjects(branchSubjects);

      // Filter allocations for branch classes
      const classIds = branchClasses.map(c => c.id);
      const branchAllocations = allocationsData.filter(a => classIds.includes(a.class_id));
      setAllAllocations(branchAllocations);

    } catch (err) {
      console.error(err);
      toast.error('Failed to load database settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminBranch) {
      loadDatabaseData();
    }
  }, [adminBranch]);

  // Sync target classes and allocated subjects when semester changes
  useEffect(() => {
    const semesterClasses = classes.filter(c => c.semester === selectedSemester);
    setTargetClasses(semesterClasses);
    if (semesterClasses.length > 0) {
      setPreviewClassId(semesterClasses[0].id);
    } else {
      setPreviewClassId('');
    }

    const classIds = semesterClasses.map(c => c.id);
    const semesterAllocations = allAllocations.filter(a => classIds.includes(a.class_id) && a.semester === selectedSemester);
    
    // Find unique subjects in these allocations
    const subjectIds = [...new Set(semesterAllocations.map(a => a.subject_id))];
    const subjectsInAlloc = allSubjects.filter(s => subjectIds.includes(s.id) || subjectIds.includes(s.$id));

    // Build configured subjects
    const configs = subjectsInAlloc.map(sub => {
      const isLabDefault = sub.is_lab_integrated === true || sub.courseName?.toLowerCase().includes('lab') || sub.courseCode?.toLowerCase().endsWith('l');
      const isElectiveDefault = sub.courseName?.toLowerCase().includes('elective') || ['pec', 'esc', 'cte', 'oe'].some(keyword => sub.courseShortName?.toLowerCase().includes(keyword));

      // Build default teacher mappings from allocations & teacher assignments
      const teachersMapping = {};
      const roomsMapping = {};
      const labRoomsMapping = {};
      semesterClasses.forEach(cls => {
        // Find teacher assigned to this class and subject
        const teacherMatch = teachers.find(t => {
          const assignments = t.class_assignments || [];
          return assignments.some(a => 
            a.class_id === cls.id && 
            a.subject && a.subject.trim().toLowerCase() === sub.courseName.trim().toLowerCase()
          );
        });
        teachersMapping[cls.id] = teacherMatch ? teacherMatch.name : '';
        roomsMapping[cls.id] = '';
        labRoomsMapping[cls.id] = isLabDefault ? 'Lab' : '';
      });

      return {
        id: sub.id || sub.$id,
        courseCode: sub.courseCode,
        courseName: sub.courseName,
        courseShortName: sub.courseShortName || sub.courseName,
        weeklyPeriods: isLabDefault ? 3 : 4, // 3 theory periods default for integrated lab
        isLab: isLabDefault,
        labDuration: isLabDefault ? 2 : 2, // 2 periods lab by default
        weeklyLabs: isLabDefault ? 1 : 0, // default 1 lab slot per week if lab
        isElective: isElectiveDefault,
        teachers: teachersMapping,
        rooms: roomsMapping,
        labRooms: labRoomsMapping
      };
    });

    setConfiguredSubjects(configs);
    // Clear generated options when inputs change
    setOptions([]);
    setPromptConstraints([]);
    setPromptText('');
  }, [selectedSemester, classes, allSubjects, allAllocations]);

  // Handle configuration changes
  const handleSubjectConfigChange = (idx, key, value) => {
    setConfiguredSubjects(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [key]: value };
      return updated;
    });
  };

  const handleTeacherMappingChange = (subIdx, classId, teacherName) => {
    setConfiguredSubjects(prev => {
      const updated = [...prev];
      const updatedTeachers = { ...updated[subIdx].teachers, [classId]: teacherName };
      updated[subIdx] = { ...updated[subIdx], teachers: updatedTeachers };
      return updated;
    });
  };

  const handleRoomMappingChange = (subIdx, classId, room) => {
    setConfiguredSubjects(prev => {
      const updated = [...prev];
      const updatedRooms = { ...updated[subIdx].rooms, [classId]: room };
      updated[subIdx] = { ...updated[subIdx], rooms: updatedRooms };
      return updated;
    });
  };

  const handleLabRoomMappingChange = (subIdx, classId, labRoom) => {
    setConfiguredSubjects(prev => {
      const updated = [...prev];
      const updatedLabRooms = { ...updated[subIdx].labRooms, [classId]: labRoom };
      updated[subIdx] = { ...updated[subIdx], labRooms: updatedLabRooms };
      return updated;
    });
  };

  // Solver Algorithm Implementation
  const runCSPSolver = (constraintsList) => {
    // Generate 4 options
    const generatedOptions = [];
    
    // We want 4 different valid timetables
    for (let oIdx = 0; oIdx < 4; oIdx++) {
      const schedule = attemptGenerateOption(constraintsList);
      if (schedule) {
        generatedOptions.push(schedule);
      }
    }

    return generatedOptions;
  };

  const attemptGenerateOption = (constraintsList) => {
    const days = DAYS;
    const periods = slots;
    const getPeriodsForDay = (day) => day === 'Saturday' ? periods.slice(0, 2) : periods;

    const shuffleArray = (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
    };

    // Check active day duration constraints
    const mixedTargetsActive = constraintsList.some(tc => tc.type === 'day_durations_mixed');
    const target9to3Active = constraintsList.some(tc => tc.type === 'one_day_9to3');
    const target9to4Active = constraintsList.some(tc => tc.type === 'one_day_9to4');

    // Initialize schedule grid for target classes
    const grid = {};
    targetClasses.forEach(c => {
      grid[c.id] = {};
      days.forEach(d => {
        grid[c.id][d] = Array(getPeriodsForDay(d).length).fill(null);
      });
    });

    // Busy teacher registry: busyTeachers[teacherName][day][periodIdx] = true
    const busyTeachers = {};
    const isTeacherBusy = (teacher, day, pIdx) => {
      if (!teacher) return false;
      return busyTeachers[teacher]?.[day]?.[pIdx] === true;
    };
    const setTeacherBusy = (teacher, day, pIdx, busy) => {
      if (!teacher) return;
      if (!busyTeachers[teacher]) busyTeachers[teacher] = {};
      if (!busyTeachers[teacher][day]) busyTeachers[teacher][day] = [];
      busyTeachers[teacher][day][pIdx] = busy;
    };

    // Apply forced free periods constraints from prompt and day duration targets
    targetClasses.forEach(c => {
      let day9to3 = null;
      let day9to4 = null;
      const weekdayList = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      shuffleArray(weekdayList);

      if (mixedTargetsActive) {
        day9to3 = weekdayList[0];
        day9to4 = weekdayList[1];
      } else {
        if (target9to3Active) day9to3 = weekdayList[0];
        if (target9to4Active) day9to4 = target9to3Active ? weekdayList[1] : weekdayList[0];
      }

      days.forEach(day => {
        const slotsCount = getPeriodsForDay(day).length;
        for (let pIdx = 0; pIdx < slotsCount; pIdx++) {
          let isForcedFree = constraintsList.some(tc => {
            if (tc.type === 'free_afternoon' && tc.day === day && pIdx >= 4) return true;
            if (tc.type === 'free_day' && tc.day === day) return true;
            return false;
          });

          if (day === day9to3 && pIdx >= 5) {
            isForcedFree = true; // Ends at 3 PM
          }
          if (day === day9to4 && pIdx >= 6) {
            isForcedFree = true; // Ends at 4 PM
          }

          if (isForcedFree) {
            grid[c.id][day][pIdx] = { subject: 'Free', teacher: '', room: '' };
          }
        }
      });
    });

    const solve = () => {
      // 1. Group electives by courseShortName to schedule them at the same time
      const electiveSubjects = configuredSubjects.filter(s => s.isElective);
      const electiveGroups = {};
      electiveSubjects.forEach(s => {
        const key = s.courseShortName;
        if (!electiveGroups[key]) electiveGroups[key] = [];
        electiveGroups[key].push(s);
      });

      for (const [shortName, groupSubs] of Object.entries(electiveGroups)) {
        let periodsNeeded = Math.max(...groupSubs.map(s => s.weeklyPeriods || 3));
        const candidateSlots = [];
        
        days.forEach(day => {
          const slotsCount = getPeriodsForDay(day).length;
          for (let pIdx = 0; pIdx < slotsCount; pIdx++) {
            // Check if free in all sections
            const allFree = targetClasses.every(c => grid[c.id][day][pIdx] === null);
            if (!allFree) continue;

            // Check if teachers are free
            let teachersFree = true;
            for (const sub of groupSubs) {
              const freeForAllClasses = targetClasses.every(c => {
                const teacher = sub.teachers[c.id];
                return !isTeacherBusy(teacher, day, pIdx);
              });
              if (!freeForAllClasses) {
                teachersFree = false;
                break;
              }
            }
            if (!teachersFree) continue;

            // Check prompt constraints (e.g. no DMS on Monday)
            const subjectRestricted = constraintsList.some(tc => {
              if (tc.type === 'no_subject' && tc.subject.toLowerCase() === shortName.toLowerCase() && tc.day === day) return true;
              return false;
            });
            if (subjectRestricted) continue;

            candidateSlots.push({ day, pIdx });
          }
        });

        shuffleArray(candidateSlots);

        if (candidateSlots.length < periodsNeeded) return false;

        const chosenSlots = [];
        for (let i = 0; i < periodsNeeded; i++) {
          let slotIdx = candidateSlots.findIndex(slot => 
            !chosenSlots.some(chosen => chosen.day === slot.day)
          );
          if (slotIdx === -1) {
            slotIdx = 0;
          }
          const chosen = candidateSlots.splice(slotIdx, 1)[0];
          chosenSlots.push(chosen);
        }

        for (let i = 0; i < periodsNeeded; i++) {
          const { day, pIdx } = chosenSlots[i];
          targetClasses.forEach(c => {
            const teachersList = groupSubs.map(sub => sub.teachers[c.id]).filter(Boolean);
            const roomsList = groupSubs.map(sub => sub.rooms[c.id] || sub.labRooms?.[c.id]).filter(Boolean);
            
            const teacherStr = [...new Set(teachersList)].join(' / ');
            const roomStr = [...new Set(roomsList)].join(' / ');

            grid[c.id][day][pIdx] = { 
              subject: shortName, 
              teacher: teacherStr, 
              room: roomStr 
            };

            // Mark all teachers of electives in this group as busy in this slot
            groupSubs.forEach(sub => {
              const teacher = sub.teachers[c.id];
              setTeacherBusy(teacher, day, pIdx, true);
            });
          });
        }
      }

      // 2. Labs next (contiguous periods, e.g. 2 or 3 hours)
      const labs = configuredSubjects.filter(s => s.isLab && !s.isElective);
      const classOrder = [...targetClasses];
      shuffleArray(classOrder);

      for (const c of classOrder) {
        const classLabs = [...labs];
        shuffleArray(classLabs);

        for (const sub of classLabs) {
          const duration = sub.labDuration || 2;
          const labsCount = sub.weeklyLabs || 1;
          
          for (let l = 0; l < labsCount; l++) {
            let placed = false;

            // Define starting index blocks for labs avoiding lunch/tea breaks
            const blocks = [];
            days.forEach(day => {
              const maxPeriods = day === 'Saturday' ? 2 : periods.length;
              for (let i = 0; i <= maxPeriods - duration; i++) {
                let crossesLunch = false;
                for (let offset = 0; offset < duration - 1; offset++) {
                  const endCurrent = periods[i + offset].end;
                  const startNext = periods[i + offset + 1].start;
                  
                  const parseMin = (tStr) => {
                    const [h, m] = tStr.split(':').map(Number);
                    return h * 60 + m;
                  };
                  
                  if (parseMin(startNext) - parseMin(endCurrent) > 30) {
                    crossesLunch = true;
                    break;
                  }
                }
                if (!crossesLunch) {
                  blocks.push({ day, startIdx: i });
                }
              }
            });

            shuffleArray(blocks);

            for (const block of blocks) {
              const { day, startIdx } = block;

              // Check if slots are free for this section
              let blockFree = true;
              for (let offset = 0; offset < duration; offset++) {
                if (grid[c.id][day][startIdx + offset] !== null) {
                  blockFree = false;
                  break;
                }
              }
              if (!blockFree) continue;

              // Check teacher availability
              const teacher = sub.teachers[c.id] || '';
              let teacherFree = true;
              for (let offset = 0; offset < duration; offset++) {
                if (isTeacherBusy(teacher, day, startIdx + offset)) {
                  teacherFree = false;
                  break;
                }
              }
              if (!teacherFree) continue;

              // Check prompt constraints
              const subjectRestricted = constraintsList.some(tc => {
                if (tc.type === 'no_subject' && tc.subject.toLowerCase() === sub.courseShortName.toLowerCase() && tc.day === day) return true;
                return false;
              });
              if (subjectRestricted) continue;

              // Place lab slots
              for (let offset = 0; offset < duration; offset++) {
                const labRoom = sub.labRooms?.[c.id] || 'Lab';
                const subjectLabel = sub.courseShortName.toLowerCase().includes('lab')
                  ? sub.courseShortName
                  : `${sub.courseShortName} Lab`;
                grid[c.id][day][startIdx + offset] = { subject: subjectLabel, teacher, room: labRoom };
                setTeacherBusy(teacher, day, startIdx + offset, true);
              }
              placed = true;
              break;
            }

            if (!placed) return false;
          }
        }
      }

      // 3. Regular Theory subjects
      const theory = configuredSubjects.filter(s => s.weeklyPeriods > 0 && !s.isElective);
      for (const c of targetClasses) {
        const slotsToFill = [];
        theory.forEach(sub => {
          const periodsNeeded = sub.weeklyPeriods || 0;
          for (let i = 0; i < periodsNeeded; i++) {
            slotsToFill.push(sub);
          }
        });

        shuffleArray(slotsToFill);

        for (const sub of slotsToFill) {
          let placed = false;
          const freeSlots = [];
          
          days.forEach(day => {
            const slotsCount = getPeriodsForDay(day).length;
            for (let pIdx = 0; pIdx < slotsCount; pIdx++) {
              if (grid[c.id][day][pIdx] === null) {
                freeSlots.push({ day, pIdx });
              }
            }
          });

          // Sort free slots to fill earlier periods first (e.g. 0 to 4)
          // keeps later periods free at the end of the day
          freeSlots.sort((a, b) => a.pIdx - b.pIdx);

          // Split free slots into preferred (subject not scheduled on that day yet) and fallback
          const preferredSlots = [];
          const fallbackSlots = [];

          freeSlots.forEach(slot => {
            const { day } = slot;
            const alreadyScheduledOnDay = grid[c.id][day].some(cell => 
              cell !== null && 
              (cell.subject === sub.courseShortName || 
               cell.subject === `${sub.courseShortName} Lab` || 
               cell.subject.startsWith(sub.courseShortName))
            );
            if (alreadyScheduledOnDay) {
              fallbackSlots.push(slot);
            } else {
              preferredSlots.push(slot);
            }
          });

          const orderedSlots = [...preferredSlots, ...fallbackSlots];

          for (const slot of orderedSlots) {
            const { day, pIdx } = slot;
            const teacher = sub.teachers[c.id] || '';
            if (isTeacherBusy(teacher, day, pIdx)) continue;

            // Check prompt constraints
            const subjectRestricted = constraintsList.some(tc => {
              if (tc.type === 'no_subject' && tc.subject.toLowerCase() === sub.courseShortName.toLowerCase() && tc.day === day) return true;
              return false;
            });
            if (subjectRestricted) continue;

            grid[c.id][day][pIdx] = { subject: sub.courseShortName, teacher, room: sub.rooms[c.id] || '' };
            setTeacherBusy(teacher, day, pIdx, true);
            placed = true;
            break;
          }

          if (!placed) return false;
        }
      }

      // Fill empty slots with Free
      targetClasses.forEach(c => {
        days.forEach(day => {
          const slotsCount = getPeriodsForDay(day).length;
          for (let pIdx = 0; pIdx < slotsCount; pIdx++) {
            if (grid[c.id][day][pIdx] === null) {
              grid[c.id][day][pIdx] = { subject: 'Free', teacher: '', room: '' };
            }
          }
        });
      });

      return true;
    };

    // Run solver with up to 1000 restarts
    for (let attempt = 0; attempt < 1000; attempt++) {
      // Deep copy grid & clear busy teachers
      targetClasses.forEach(c => {
        days.forEach(d => {
          grid[c.id][d].fill(null);
        });
      });
      Object.keys(busyTeachers).forEach(k => delete busyTeachers[k]);

      // Apply forced free periods and day duration targets
      targetClasses.forEach(c => {
        let day9to3 = null;
        let day9to4 = null;
        const weekdayList = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        shuffleArray(weekdayList);

        if (mixedTargetsActive) {
          day9to3 = weekdayList[0];
          day9to4 = weekdayList[1];
        } else {
          if (target9to3Active) day9to3 = weekdayList[0];
          if (target9to4Active) day9to4 = target9to3Active ? weekdayList[1] : weekdayList[0];
        }

        days.forEach(day => {
          const slotsCount = getPeriodsForDay(day).length;
          for (let pIdx = 0; pIdx < slotsCount; pIdx++) {
            let isForcedFree = constraintsList.some(tc => {
              if (tc.type === 'free_afternoon' && tc.day === day && pIdx >= 4) return true;
              if (tc.type === 'free_day' && tc.day === day) return true;
              return false;
            });

            if (day === day9to3 && pIdx >= 5) {
              isForcedFree = true; // Ends at 3 PM
            }
            if (day === day9to4 && pIdx >= 6) {
              isForcedFree = true; // Ends at 4 PM
            }

            if (isForcedFree) {
              grid[c.id][day][pIdx] = { subject: 'Free', teacher: '', room: '' };
            }
          }
        });
      });

      if (solve()) {
        return grid;
      }
    }

    return null;
  };

  const handleGenerate = () => {
    // Validate target classes exist
    if (targetClasses.length === 0) {
      return toast.error('No class sections found for the selected semester');
    }

    // Validate that subjects are loaded
    if (configuredSubjects.length === 0) {
      return toast.error('No allocated subjects found. Allocate subjects first under "Manage Subjects".');
    }

    setGenerating(true);
    // Timeout to allow UI loader to render
    setTimeout(() => {
      try {
        const results = runCSPSolver(promptConstraints);
        if (results.length > 0) {
          setOptions(results);
          setActiveOptionIdx(0);
          toast.success(`Successfully generated ${results.length} timetable option(s)!`);
        } else {
          toast.error('Could not generate a conflict-free timetable. Try relaxing constraints or allocating different teachers.');
        }
      } catch (err) {
        console.error(err);
        toast.error('Solver encountered an error');
      } finally {
        setGenerating(false);
      }
    }, 150);
  };

  // Parser for AI-like text commands
  const parsePromptRefinements = () => {
    if (!promptText.trim()) return;
    const text = promptText.toLowerCase().trim();
    const newConstraints = [...promptConstraints];

    // Check for "free Friday afternoon"
    const daysKeywords = {
      'monday': 'Monday',
      'tuesday': 'Tuesday',
      'wednesday': 'Wednesday',
      'thursday': 'Thursday',
      'friday': 'Friday',
      'saturday': 'Saturday'
    };

    let matched = false;

    // Mixed/Custom Day Duration Targets
    if (text.includes('9 to 3') && text.includes('9 to 4')) {
      newConstraints.push({
        type: 'day_durations_mixed',
        description: 'For each class: exactly 1 day 9 to 3, 1 day 9 to 4, and 1 day 9 to 5'
      });
      matched = true;
    } else if (text.includes('9 to 3')) {
      newConstraints.push({
        type: 'one_day_9to3',
        description: 'For each class: at least 1 day ends at 3 PM (9 to 3)'
      });
      matched = true;
    } else if (text.includes('9 to 4')) {
      newConstraints.push({
        type: 'one_day_9to4',
        description: 'For each class: at least 1 day ends at 4 PM (9 to 4)'
      });
      matched = true;
    }

    // 1. Check for free afternoon
    Object.keys(daysKeywords).forEach(key => {
      if (text.includes(`free ${key} afternoon`) || text.includes(`${key} afternoon free`)) {
        newConstraints.push({
          type: 'free_afternoon',
          day: daysKeywords[key],
          description: `Lock ${daysKeywords[key]} afternoon periods (2:00 - 5:00 PM) to Free`
        });
        matched = true;
      }
    });

    // 2. Check for free day
    Object.keys(daysKeywords).forEach(key => {
      if (!text.includes(`${key} afternoon`) && (text.includes(`free ${key}`) || text.includes(`${key} free`))) {
        newConstraints.push({
          type: 'free_day',
          day: daysKeywords[key],
          description: `Lock the entire day of ${daysKeywords[key]} to Free`
        });
        matched = true;
      }
    });

    // 3. Check for "no [subject] on [day]"
    configuredSubjects.forEach(sub => {
      const alias = sub.courseShortName.toLowerCase();
      const code = sub.courseCode.toLowerCase();
      
      Object.keys(daysKeywords).forEach(key => {
        if ((text.includes(`no ${alias} on ${key}`) || text.includes(`no ${code} on ${key}`)) || 
            (text.includes(`avoid ${alias} on ${key}`) || text.includes(`avoid ${code} on ${key}`))) {
          newConstraints.push({
            type: 'no_subject',
            subject: sub.courseShortName,
            day: daysKeywords[key],
            description: `Avoid scheduling ${sub.courseShortName} on ${daysKeywords[key]}`
          });
          matched = true;
        }
      });
    });

    if (matched) {
      setPromptConstraints(newConstraints);
      setPromptText('');
      toast.success('Added prompt constraint! Regenerating...');
      
      // Auto regenerate after updating constraints list
      setGenerating(true);
      setTimeout(() => {
        const results = runCSPSolver(newConstraints);
        if (results.length > 0) {
          setOptions(results);
          setActiveOptionIdx(0);
          toast.success('Timetable options updated based on prompt!');
        } else {
          toast.error('Constraints are too tight. Timetable could not be resolved. Reverting constraint.');
          newConstraints.pop(); // Remove the last one
          setPromptConstraints(newConstraints);
        }
        setGenerating(false);
      }, 150);

    } else {
      toast.error('Could not understand prompt. Try: "free Friday afternoon" or "no DBMS on Monday".');
    }
  };

  const handleClearConstraints = () => {
    setPromptConstraints([]);
    setOptions([]);
    toast.success('Cleared all constraints');
  };

  // Cell Click / Double-Click Manual Override Handler
  const handleCellDoubleClick = (day, slotIdx) => {
    if (options.length === 0) return;
    const currentOptionGrid = options[activeOptionIdx];
    const cellValue = currentOptionGrid[previewClassId]?.[day]?.[slotIdx] || { subject: 'Free', teacher: '', room: '' };
    
    setOverrideCell({ day, slotIdx, classId: previewClassId });
    setOverrideForm({
      subject: cellValue.subject || 'Free',
      teacher: cellValue.teacher || '',
      room: cellValue.room || ''
    });
    setShowOverrideModal(true);
  };

  const saveOverride = () => {
    if (!overrideCell) return;
    const { day, slotIdx, classId } = overrideCell;
    
    setOptions(prev => {
      const updated = [...prev];
      const optionGrid = { ...updated[activeOptionIdx] };
      const classGrid = { ...optionGrid[classId] };
      const dayGrid = [...classGrid[day]];

      dayGrid[slotIdx] = {
        subject: overrideForm.subject,
        teacher: overrideForm.subject === 'Free' ? '' : overrideForm.teacher,
        room: overrideForm.subject === 'Free' ? '' : overrideForm.room
      };

      classGrid[day] = dayGrid;
      optionGrid[classId] = classGrid;
      updated[activeOptionIdx] = optionGrid;
      return updated;
    });

    setShowOverrideModal(false);
    setOverrideCell(null);
    toast.success('Cell overridden successfully!');
  };

  // Database Save Handler
  const handleSaveToDatabase = async () => {
    if (options.length === 0) return;
    if (!window.confirm(`Are you sure you want to apply Option ${activeOptionIdx + 1} to the database? This will replace all existing timetable entries for ${selectedSemester} classes.`)) {
      return;
    }

    setSaving(true);
    try {
      const activeOption = options[activeOptionIdx];
      const classIds = targetClasses.map(c => c.id);

      // 1. Fetch and delete existing timetable documents for these classes
      const deletePromises = [];
      for (const cid of classIds) {
        const existingDocs = await queryDocuments('timetable', [Query.equal('class_id', cid)]);
        existingDocs.forEach(doc => {
          deletePromises.push(deleteDocument('timetable', doc.id || doc.$id));
        });
      }
      
      if (deletePromises.length > 0) {
        await Promise.all(deletePromises);
      }

      // 2. Add new timetable documents
      const addPromises = [];

      classIds.forEach(cid => {
        const classGrid = activeOption[cid];
        DAYS.forEach(day => {
          const daySlots = classGrid[day] || [];
          daySlots.forEach((slotData, sIdx) => {
            // Only write actual subjects to the database, skip "Free" slots
            if (slotData && slotData.subject && slotData.subject !== 'Free') {
              const timing = slots[sIdx];
              const docData = {
                class_id: cid,
                subject: slotData.subject,
                teacher: slotData.teacher || '',
                room: slotData.room || '',
                time: `${timing.start} - ${timing.end}`,
                day: day,
                status: 'normal'
              };
              addPromises.push(addDocument('timetable', docData));
            }
          });
        });
      });

      if (addPromises.length > 0) {
        await Promise.all(addPromises);
      }

      // Save custom slots to localStorage for each target class
      classIds.forEach(cid => {
        localStorage.setItem(`tt-slots-${cid}`, JSON.stringify(slots));
      });

      // 3. Log actions
      await addChangeLog({
        timetable_id: `${adminBranch}_semester_${selectedSemester.replace(/\s+/g, '_')}`,
        action: 'AI Auto-Generated Timetable',
        details: `Auto-generated and applied weekly schedules for ${selectedSemester} sections: ${targetClasses.map(c => c.section).join(', ')}`,
        changed_by: 'admin',
        changed_by_name: userProfile?.name || 'Admin',
        changed_by_role: 'admin'
      });

      // 4. Notify students
      try {
        for (const cid of classIds) {
          const students = await getStudentsByClass(cid);
          for (const student of students) {
            await addNotification(student.uid, `📢 Your ${selectedSemester} class timetable has been updated by the department.`);
          }
        }
      } catch (notifErr) {
        console.error('Failed to notify students:', notifErr);
      }

      toast.success('Successfully saved and applied timetable changes to the database!');
      navigate('/admin/timetable');

    } catch (err) {
      console.error(err);
      toast.error('Failed to apply timetable: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout pageTitle="Auto-Generate Timetable">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <button className="btn btn-ghost" onClick={() => navigate('/admin/timetable')} style={{ padding: 6 }}>
          <MdArrowBack size={20} />
        </button>
        <div>
          <h1 className="page-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            🤖 Make Timetable
          </h1>
          <p className="page-subtitle" style={{ margin: 0 }}>
            Automated Constraint Solver — generate college schedules with zero headaches
          </p>
        </div>
      </div>

      {loading ? (
        <div className="loader-container" style={{ minHeight: 250 }}><div className="loader" /></div>
      ) : (
        <div className="grid-col gap-24">
          
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: 24, alignItems: 'start' }}>
            {/* Setup card */}
            <div className="card" style={{ height: '100%' }}>
              <h3 className="mb-16" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                ⚙️ Generation Parameters
              </h3>

            <div className="form-group mb-16" style={{ maxWidth: 300 }}>
              <label className="form-label">Select Semester *</label>
              <select 
                className="form-control" 
                value={selectedSemester} 
                onChange={(e) => setSelectedSemester(e.target.value)}
              >
                {SEMESTERS.map(sem => <option key={sem} value={sem}>{sem}</option>)}
              </select>
            </div>

            {targetClasses.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <p>⚠️ No classes exist in your branch for this semester. Create classes first.</p>
              </div>
            ) : (
              <>
                <div className="mb-16" style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                  Found <strong>{targetClasses.length} class section(s)</strong>: {targetClasses.map(c => c.label).join(', ')}
                </div>

                  <div className="table-wrapper mb-16" style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <table style={{ minWidth: 700 }}>
                    <thead>
                      <tr>
                        <th>Subject Name</th>
                        <th style={{ width: 100 }}>Periods/Wk</th>
                        <th style={{ width: 100 }}>Is Lab?</th>
                        <th style={{ width: 100 }}>Elective?</th>
                        {targetClasses.map(cls => (
                          <th key={cls.id}>Allocations ({cls.section})</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {configuredSubjects.map((sub, sIdx) => (
                        <tr key={sub.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{sub.courseShortName}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{sub.courseName}</div>
                          </td>
                          <td>
                            <input 
                              type="number"
                              className="form-control"
                              style={{ width: 70 }}
                              min={0}
                              max={10}
                              value={sub.weeklyPeriods}
                              onChange={(e) => handleSubjectConfigChange(sIdx, 'weeklyPeriods', parseInt(e.target.value) || 0)}
                            />
                          </td>
                          <td>
                            <div className="flex-col gap-4">
                              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                <input 
                                  type="checkbox"
                                  checked={sub.isLab}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    handleSubjectConfigChange(sIdx, 'isLab', checked);
                                    handleSubjectConfigChange(sIdx, 'weeklyLabs', checked ? 1 : 0);
                                    if (checked) {
                                      const updatedLabRooms = { ...sub.labRooms };
                                      targetClasses.forEach(cls => {
                                        if (!updatedLabRooms[cls.id]) {
                                          updatedLabRooms[cls.id] = 'Lab';
                                        }
                                      });
                                      handleSubjectConfigChange(sIdx, 'labRooms', updatedLabRooms);
                                    }
                                  }}
                                  style={{ width: 18, height: 18 }}
                                />
                                <span style={{ fontSize: '0.8rem' }}>Yes</span>
                              </label>
                              {sub.isLab && (
                                <div className="flex-col gap-4 mt-8" style={{ borderLeft: '2px solid var(--primary-light)', paddingLeft: 6 }}>
                                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Duration:</div>
                                  <select 
                                    className="form-control"
                                    style={{ width: 85, padding: 2, fontSize: '0.7rem' }}
                                    value={sub.labDuration}
                                    onChange={(e) => handleSubjectConfigChange(sIdx, 'labDuration', parseInt(e.target.value))}
                                  >
                                    <option value={2}>2 periods</option>
                                    <option value={3}>3 periods</option>
                                    <option value={4}>4 periods</option>
                                  </select>
                                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 4 }}>Labs/wk:</div>
                                  <input 
                                    type="number"
                                    className="form-control"
                                    style={{ width: 85, padding: 2, fontSize: '0.7rem' }}
                                    min={1}
                                    max={5}
                                    value={sub.weeklyLabs || 1}
                                    onChange={(e) => handleSubjectConfigChange(sIdx, 'weeklyLabs', parseInt(e.target.value) || 1)}
                                  />
                                </div>
                              )}
                            </div>
                          </td>
                          <td>
                            <input 
                              type="checkbox"
                              checked={sub.isElective}
                              onChange={(e) => handleSubjectConfigChange(sIdx, 'isElective', e.target.checked)}
                              style={{ width: 18, height: 18 }}
                            />
                          </td>
                          {targetClasses.map(cls => (
                            <td key={cls.id}>
                              <div className="flex-col gap-8">
                                <select 
                                  className="form-control"
                                  style={{ padding: 4, fontSize: '0.78rem' }}
                                  value={sub.teachers[cls.id] || ''}
                                  onChange={(e) => handleTeacherMappingChange(sIdx, cls.id, e.target.value)}
                                >
                                  <option value="">— Teacher —</option>
                                  {teachers.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                                </select>
                                <input 
                                  className="form-control"
                                  style={{ padding: 4, fontSize: '0.78rem' }}
                                  placeholder="Theory Room"
                                  value={sub.rooms[cls.id] || ''}
                                  onChange={(e) => handleRoomMappingChange(sIdx, cls.id, e.target.value)}
                                />
                                {sub.isLab && (
                                  <input 
                                    className="form-control"
                                    style={{ padding: 4, fontSize: '0.78rem' }}
                                    placeholder="Lab Room"
                                    value={sub.labRooms?.[cls.id] || ''}
                                    onChange={(e) => handleLabRoomMappingChange(sIdx, cls.id, e.target.value)}
                                  />
                                )}
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex" style={{ justifyContent: 'flex-end' }}>
                  <button 
                    className="btn btn-primary" 
                    onClick={handleGenerate}
                    disabled={generating}
                    style={{ padding: '8px 20px', borderRadius: 'var(--radius)', background: 'linear-gradient(135deg, #4f46e5 0%, #4285F4 100%)' }}
                  >
                    <MdAutoAwesome /> {generating ? 'Solving CSP...' : 'Generate Option Grids ⚡'}
                  </button>
                </div>
              </>
            )}
            </div>

            {/* Time Slots Column Configuration */}
            <div className="card" style={{ height: '100%' }}>
              <h3 className="mb-16" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                ⏰ Time Slots Grid (Columns)
              </h3>
              <p className="text-muted mb-16" style={{ fontSize: '0.8rem', lineHeight: 1.4 }}>
                Define the weekly timetable periods. Delete or add columns to change rows/columns.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 380, overflowY: 'auto', paddingRight: 4 }}>
                {slots.map((slot, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'var(--surface-2)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, minWidth: 20 }}>#{idx + 1}</span>
                    
                    <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                      <input 
                        type="time" 
                        className="form-control" 
                        style={{ padding: 4 }}
                        value={slot.start} 
                        onChange={(e) => handleSlotTimeChange(idx, 'start', e.target.value)} 
                      />
                      <span style={{ alignSelf: 'center' }}>-</span>
                      <input 
                        type="time" 
                        className="form-control" 
                        style={{ padding: 4 }}
                        value={slot.end} 
                        onChange={(e) => handleSlotTimeChange(idx, 'end', e.target.value)} 
                      />
                    </div>
                    
                    <button 
                      type="button" 
                      className="btn btn-sm btn-ghost"
                      style={{ color: 'var(--danger)', borderColor: 'rgba(234, 67, 53, 0.2)' }}
                      onClick={() => handleRemoveSlot(idx)}
                      disabled={slots.length <= 1}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
              
              <button 
                type="button" 
                className="btn btn-secondary mt-16 w-full"
                onClick={handleAddSlot}
              >
                ➕ Add Time Slot Column
              </button>
            </div>
          </div>

          {/* Results section */}
          {generating && (
            <div className="card text-center" style={{ padding: 40 }}>
              <div className="loader mb-16" style={{ margin: '0 auto' }} />
              <h3>Calculating Conflict-Free Combinations...</h3>
              <p className="text-muted">Analyzing teacher busy states, elective alignments, and contiguous lab slots...</p>
            </div>
          )}

          {!generating && options.length > 0 && (
            <div className="card card-lg" style={{ animation: 'fadeIn 0.25s ease' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
                <div>
                  <h3>📊 Solver Results</h3>
                  <p className="text-muted" style={{ margin: 0 }}>Select an option to view and manually tweak details.</p>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  {options.map((_, idx) => (
                    <button 
                      key={idx} 
                      className={`btn ${activeOptionIdx === idx ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setActiveOptionIdx(idx)}
                    >
                      Option {idx + 1}
                    </button>
                  ))}
                </div>
              </div>

              {/* Section selector preview */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto' }}>
                {targetClasses.map(cls => (
                  <button 
                    key={cls.id}
                    className={`btn btn-sm ${previewClassId === cls.id ? 'btn-secondary' : 'btn-ghost'}`}
                    style={previewClassId === cls.id ? { background: 'var(--primary-light)', color: 'var(--primary)', borderColor: 'var(--primary)' } : {}}
                    onClick={() => setPreviewClassId(cls.id)}
                  >
                    🏫 {cls.label}
                  </button>
                ))}
              </div>

              <div className="mb-16" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--info)' }}>
                <MdInfo /> Double-click any cell to manually edit/override its slots.
              </div>

              {/* Timetable Weekly Grid Preview */}
              <div className="tt-scroll-wrapper mb-24">
                <div
                  className="tt-grid"
                  style={{ gridTemplateColumns: `100px repeat(${slots.length}, minmax(100px, 1fr))` }}
                >
                  {/* Header Row */}
                  <div className="tt-corner" style={{ fontSize: '0.9rem', fontWeight: 700 }}>Day / Time</div>
                  {slots.map((slot, sIdx) => (
                    <div key={sIdx} className="tt-header">
                      <div className="tt-header-time" style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                        {formatTime(slot.start)} - {formatTime(slot.end)}
                      </div>
                    </div>
                  ))}

                  {/* Day Rows */}
                  {DAYS.map((day, dIdx) => {
                    const slotsCount = day === 'Saturday' ? 2 : slots.length;
                    return (
                      <React.Fragment key={day}>
                        <div className="tt-day-label" style={{ background: 'var(--surface-2)', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 0', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', fontSize: '0.95rem' }}>
                          {day.slice(0, 3)}
                        </div>
                        {slots.map((slot, sIdx) => {
                          if (sIdx >= slotsCount) {
                            return (
                              <div 
                                key={sIdx} 
                                style={{ background: 'var(--bg)', opacity: 0.3, borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)' }} 
                              />
                            );
                          }

                          const cell = options[activeOptionIdx]?.[previewClassId]?.[day]?.[sIdx] || { subject: 'Free', teacher: '', room: '' };
                          const isFree = cell.subject === 'Free';

                          return (
                            <div
                              key={sIdx}
                              className="tt-cell"
                              onDoubleClick={() => handleCellDoubleClick(day, sIdx)}
                              style={{ 
                                cursor: 'pointer',
                                height: 100, 
                                padding: 4, 
                                borderRight: '1px solid var(--border)', 
                                borderBottom: '1px solid var(--border)',
                                background: isFree ? 'transparent' : 'var(--surface)'
                              }}
                            >
                              {!isFree ? (
                                <div 
                                  className="tt-entry"
                                  data-color={hashColor(cell.subject)}
                                  style={{ height: '100%', padding: 6, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
                                >
                                  <span className="tt-entry-subject" style={{ fontWeight: 700, fontSize: '1.05rem' }}>{cell.subject}</span>
                                  {cell.teacher && <span className="tt-entry-teacher" style={{ fontSize: '0.85rem', opacity: 0.8 }}>{cell.teacher}</span>}
                                  {cell.room && <span className="tt-entry-room" style={{ fontSize: '0.85rem', fontWeight: 500 }}>📍 {cell.room}</span>}
                                </div>
                              ) : (
                                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.88rem', fontStyle: 'italic' }}>
                                  Free
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* AI Refinement & Apply Options */}
              <div className="grid-2 mt-24" style={{ alignItems: 'start' }}>
                
                {/* Refinement input */}
                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', padding: 16, borderRadius: 'var(--radius)' }}>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: 'var(--text-primary)' }}>
                    ✨ AI Prompt Refinement
                  </h4>
                  <p style={{ fontSize: '0.78rem', marginBottom: 12, lineHeight: 1.4 }}>
                    Type request prompts to tweak constraints (e.g. <i>"free Friday afternoon"</i>, <i>"no DBMS on Monday"</i>, or mixed durations like <i>"one day 9 to 3, one day 9 to 4, one day 9 to 5"</i>).
                  </p>

                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <input 
                      type="text" 
                      className="form-control"
                      placeholder="e.g. make Friday afternoon free"
                      value={promptText}
                      onChange={(e) => setPromptText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && parsePromptRefinements()}
                    />
                    <button className="btn btn-primary" onClick={parsePromptRefinements}>
                      Refine
                    </button>
                  </div>

                  {promptConstraints.length > 0 && (
                    <div>
                      <div className="flex-between mb-8">
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                          Active Constraints ({promptConstraints.length})
                        </span>
                        <button className="btn btn-xs btn-ghost" style={{ padding: '2px 6px', fontSize: '0.7rem' }} onClick={handleClearConstraints}>
                          Clear All
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {promptConstraints.map((tc, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '0.76rem' }}>
                            <span>✔️ {tc.description}</span>
                            <button 
                              className="modal-close" 
                              style={{ fontSize: '1rem', color: 'var(--danger)' }} 
                              onClick={() => {
                                const updated = promptConstraints.filter((_, i) => i !== idx);
                                setPromptConstraints(updated);
                                setGenerating(true);
                                setTimeout(() => {
                                  const results = runCSPSolver(updated);
                                  setOptions(results);
                                  setGenerating(false);
                                }, 100);
                              }}
                            >
                              <MdClose />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Final save panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', justifyContent: 'center', padding: '16px 0' }}>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button 
                      className="btn btn-primary btn-lg" 
                      style={{ 
                        flex: 1, 
                        justifyContent: 'center',
                        background: 'linear-gradient(135deg, var(--success) 0%, #2e7d32 100%)',
                        border: 'none',
                        boxShadow: '0 4px 12px rgba(46, 125, 50, 0.25)',
                        fontSize: '0.9rem',
                        fontWeight: 700
                      }}
                      onClick={handleSaveToDatabase}
                      disabled={saving}
                    >
                      <MdSave size={18} /> {saving ? 'Saving to Database...' : 'Apply & Save Timetable 💾'}
                    </button>
                    
                    <button 
                      className="btn btn-ghost btn-lg" 
                      onClick={() => navigate('/admin/timetable')}
                      style={{ fontSize: '0.9rem' }}
                    >
                      Cancel
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 8, background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: 12, borderRadius: 'var(--radius)', color: '#b45309', fontSize: '0.78rem' }}>
                    <MdWarning size={28} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <strong>Warning:</strong> Applying this timetable will purge all existing database schedules for <strong>{selectedSemester}</strong> classes in the <strong>{adminBranch}</strong> branch.
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}
        </div>
      )}

      {/* Manual Override Modal */}
      {showOverrideModal && overrideCell && (
        <div className="modal-overlay" onClick={() => setShowOverrideModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <span className="modal-title" style={{ fontWeight: 700 }}>
                ✏️ Edit Slot: {overrideCell.day} Period {overrideCell.slotIdx + 1}
              </span>
              <button className="modal-close" onClick={() => setShowOverrideModal(false)}><MdClose /></button>
            </div>
            
            <div className="form-group mb-12">
              <label className="form-label">Select Subject</label>
              <select 
                className="form-control"
                value={overrideForm.subject}
                onChange={(e) => setOverrideForm({ ...overrideForm, subject: e.target.value })}
              >
                <option value="Free">— Free Period —</option>
                {configuredSubjects.map(sub => (
                  <option key={sub.id} value={sub.courseShortName}>
                    {sub.courseShortName} ({sub.courseName})
                  </option>
                ))}
              </select>
            </div>

            {overrideForm.subject !== 'Free' && (
              <>
                <div className="form-group mb-12">
                  <label className="form-label">Assign Teacher</label>
                  <select 
                    className="form-control"
                    value={overrideForm.teacher}
                    onChange={(e) => setOverrideForm({ ...overrideForm, teacher: e.target.value })}
                  >
                    <option value="">— Select Teacher —</option>
                    {teachers.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                  </select>
                </div>
                <div className="form-group mb-16">
                  <label className="form-label">Room / Lab</label>
                  <input 
                    type="text" 
                    className="form-control"
                    placeholder="e.g. 3302 or Python Lab"
                    value={overrideForm.room}
                    onChange={(e) => setOverrideForm({ ...overrideForm, room: e.target.value })}
                  />
                </div>
              </>
            )}

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowOverrideModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveOverride}>Apply Override</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
