import { useState, useEffect } from 'react';
import { queryDocuments, addDocument, updateDocument, deleteDocument } from '../../appwrite/database';
import { uploadFile } from '../../appwrite/storage';
import { Query } from 'appwrite';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import {
  MdHotel, MdMeetingRoom, MdPeople, MdAdd, MdClose,
  MdFilterList, MdDelete, MdEdit, MdCheckCircle, MdBlock, MdInfo,
  MdSwapHoriz, MdSend, MdSearch, MdWifi, MdAcUnit, MdBathtub,
  MdStairs, MdKingBed, MdArrowForward, MdAccessTime,
  MdPhotoLibrary, MdCloudUpload, MdChevronLeft, MdChevronRight
} from 'react-icons/md';

export default function HostelRooms({ hostelType, role }) {
  const { userProfile } = useAuth();
  const accent = hostelType === 'girls' ? '#ec4899' : '#3b82f6';
  const accentLight = hostelType === 'girls' ? 'var(--accent-light-girls)' : 'var(--accent-light-boys)';
  const accentDark = hostelType === 'girls' ? '#be185d' : '#1e40af';

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [floorFilter, setFloorFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Form State
  const [form, setForm] = useState({
    room_number: '',
    room_type: 'double',
    floor: '',
    capacity: 2,
    attached_bathroom: false,
    ac_available: false,
    description: '',
  });

  // For Student view
  const [myRoom, setMyRoom] = useState(null);
  const [studentTab, setStudentTab] = useState('my-room'); // 'my-room' or 'available'
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [switchTargetRoom, setSwitchTargetRoom] = useState(null);
  const [switchReason, setSwitchReason] = useState('');
  const [switchRequests, setSwitchRequests] = useState([]);
  const [searchRoom, setSearchRoom] = useState('');
  const [studentFloorFilter, setStudentFloorFilter] = useState('all');
  const [studentTypeFilter, setStudentTypeFilter] = useState('all');
  const [studentVacancyFilter, setStudentVacancyFilter] = useState('all');

  // For Warden view
  const [wardenTab, setWardenTab] = useState('directory'); // 'directory' or 'switches'
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingRequest, setRejectingRequest] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [wardenFilterStatus, setWardenFilterStatus] = useState('all');
  
  // For Room Allocation
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [allocatingRoom, setAllocatingRoom] = useState(null);
  const [allStudents, setAllStudents] = useState([]);
  const [allocateSearch, setAllocateSearch] = useState('');

  // For Room Gallery
  const [galleryImages, setGalleryImages] = useState([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [cardSlideIndices, setCardSlideIndices] = useState({});
  const [galleryForm, setGalleryForm] = useState({
    room_type: 'Single Room',
    customRoomType: '',
    caption: '',
    files: []
  });
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [studentGalleryFilter, setStudentGalleryFilter] = useState('all');

  const fetchRooms = async () => {
    setLoading(true);
    try {
      const data = await queryDocuments('hostelRooms', [Query.equal('hostel_type', hostelType)]);
      setRooms(data);

      if (role === 'student') {
        const studId = userProfile?.uid || '';
        const profileRoom = userProfile?.room_number;
        if (profileRoom) {
          const roomObj = data.find(r => r.room_number === profileRoom);
          if (roomObj) {
            setMyRoom(roomObj);
          } else {
            setMyRoom({
              room_number: profileRoom,
              room_type: 'double',
              floor: 2,
              capacity: 2,
              occupied_count: 2,
              attached_bathroom: true,
              ac_available: true,
              description: 'Standard double occupancy room assigned.'
            });
          }
        } else {
          const assigned = data.find(r => r.occupants && r.occupants.includes(studId));
          if (assigned) {
            setMyRoom(assigned);
          }
        }

        // Fetch switch requests for this student
        try {
          const requests = await queryDocuments('hostelComplaints', [
            Query.equal('hostel_type', hostelType),
            Query.equal('category', 'room_switch')
          ]);
          const myRequests = requests?.filter(r => r.student_id === studId || r.student_name === userProfile?.name) || [];
          setSwitchRequests(myRequests);
        } catch (e) {
          // collection might not have room_switch entries yet, that's fine
        }
      } else if (role === 'warden') {
        // Fetch all switch requests for the warden
        try {
          const requests = await queryDocuments('hostelComplaints', [
            Query.equal('hostel_type', hostelType),
            Query.equal('category', 'room_switch')
          ]);
          const sorted = requests.sort((a, b) => new Date(b.createdAt || b.$createdAt) - new Date(a.createdAt || a.$createdAt));
          setSwitchRequests(sorted);
        } catch (e) {
          console.error(e);
        }

        // Fetch all students for room allocation
        try {
          const studentDocs = await queryDocuments('students', [
            Query.equal('hostel_type', hostelType)
          ]);
          setAllStudents(studentDocs);
        } catch (studentErr) {
          console.error("Failed to load students for allocation:", studentErr);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load rooms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, [hostelType, role]);

  const fetchGalleryImages = async () => {
    setGalleryLoading(true);
    try {
      const data = await queryDocuments('hostelRoomImages', []);
      const filtered = data.filter(img => {
        if (img.hostel_type) {
          return img.hostel_type === hostelType;
        }
        return img.room_id && img.room_id.startsWith(hostelType);
      });

      const processed = filtered.map(img => {
        let roomType = img.room_type || 'General';
        let caption = img.caption || '';
        
        if (!img.room_type && img.room_id) {
          const matchRoom = rooms.find(r => r.room_id === img.room_id);
          if (matchRoom) {
            roomType = matchRoom.room_type;
            caption = matchRoom.description || `${matchRoom.room_type} visualization`;
          } else {
            if (img.room_id.includes('room_101') || img.room_id.includes('room_201')) {
              roomType = 'Single Room';
              caption = 'Premium single occupant room with study desk and AC.';
            } else if (img.room_id.includes('room_102') || img.room_id.includes('room_202')) {
              roomType = '2 Sharing';
              caption = 'Premium double occupancy room with attached washroom.';
            } else if (img.room_id.includes('room_103') || img.room_id.includes('room_203')) {
              roomType = '3 Sharing';
              caption = 'Spacious triple occupancy room with individual lockers.';
            } else if (img.room_id.includes('room_104') || img.room_id.includes('room_204')) {
              roomType = '4 Sharing';
              caption = 'Quadruple sharing standard room with study setup.';
            }
          }
        }
        
        return {
          ...img,
          room_type: roomType,
          caption: caption
        };
      });

      setGalleryImages(processed);
    } catch (err) {
      console.error('Error fetching gallery images:', err);
    } finally {
      setGalleryLoading(false);
    }
  };

  useEffect(() => {
    fetchGalleryImages();
  }, [rooms, hostelType]);

  const getGroupedGallery = (imagesList) => {
    const groups = [];
    const groupsMap = {};
    imagesList.forEach(img => {
      const key = img.room_id || img.$id;
      if (!groupsMap[key]) {
        groupsMap[key] = {
          room_id: key,
          room_type: img.room_type,
          caption: img.caption,
          hostel_type: img.hostel_type,
          images: []
        };
        groups.push(groupsMap[key]);
      }
      groupsMap[key].images.push(img);
    });
    return groups;
  };

  const handleUploadGalleryImage = async (e) => {
    e.preventDefault();
    if (!galleryForm.files || galleryForm.files.length === 0) {
      return toast.error('Please select at least one image file to upload');
    }
    
    const finalRoomType = galleryForm.room_type === 'Custom Room Type' 
      ? galleryForm.customRoomType.trim() 
      : galleryForm.room_type;
      
    if (!finalRoomType) {
      return toast.error('Please specify a room type');
    }

    setUploadingGallery(true);
    let successCount = 0;
    
    try {
      const totalFiles = galleryForm.files.length;
      const batchRoomId = `${hostelType}_gallery_${Date.now()}`;
      
      for (let i = 0; i < totalFiles; i++) {
        const fileObj = galleryForm.files[i];
        setUploadProgressText(`Uploading ${i + 1} of ${totalFiles}...`);
        
        const uploadedUrl = await uploadFile(fileObj.file);
        if (!uploadedUrl) {
          console.error(`Failed to upload file: ${fileObj.file.name}`);
          continue;
        }

        const doc = {
          image_id: `img_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`,
          room_id: batchRoomId,
          image_url: uploadedUrl,
          hostel_type: hostelType,
          room_type: finalRoomType,
          caption: galleryForm.caption.trim() || `${finalRoomType} in ${hostelType} block`
        };

        await addDocument('hostelRoomImages', doc);
        successCount++;
      }

      if (successCount > 0) {
        toast.success(`Successfully uploaded ${successCount} showcase image(s)!`);
      } else {
        throw new Error('All file uploads failed');
      }
      
      // Revoke object URLs to free up memory
      galleryForm.files.forEach(f => {
        if (f.url) URL.revokeObjectURL(f.url);
      });

      setGalleryForm({
        room_type: 'Single Room',
        customRoomType: '',
        caption: '',
        files: []
      });
      
      fetchRooms(); 
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload showcase images');
    } finally {
      setUploadingGallery(false);
      setUploadProgressText('');
    }
  };

  const handleDeleteGalleryImage = async (imgGroup) => {
    const count = imgGroup.images.length;
    const confirmMsg = count > 1 
      ? `Are you sure you want to delete this room showcase containing ${count} images?` 
      : 'Are you sure you want to delete this gallery image?';
      
    if (!window.confirm(confirmMsg)) return;
    
    try {
      for (const img of imgGroup.images) {
        await deleteDocument('hostelRoomImages', img.$id);
      }
      toast.success('Room showcase deleted successfully');
      fetchRooms(); 
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete showcase');
    }
  };

  // Room switch request handler
  const handleSwitchRequest = async () => {
    if (!switchReason.trim()) {
      return toast.error('Please provide a reason for the room switch');
    }
    setSubmitting(true);
    try {
      const request = {
        complaint_id: `switch_${Date.now()}`,
        student_id: userProfile?.uid || '',
        student_name: userProfile?.name || 'Student',
        student_usn: userProfile?.usn || '',
        hostel_type: hostelType,
        category: 'room_switch',
        title: `Room Switch Request: ${myRoom?.room_number || 'Unassigned'} → ${switchTargetRoom.room_number}`,
        message: switchReason.trim(),
        current_room: myRoom?.room_number || 'Not Assigned',
        requested_room: switchTargetRoom.room_number,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      await addDocument('hostelComplaints', request);
      toast.success('Room switch request submitted! The warden will review it.');
      setShowSwitchModal(false);
      setSwitchReason('');
      setSwitchTargetRoom(null);
      fetchRooms();
    } catch (err) {
      console.error(err);
      toast.error('Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveSwitch = async (req) => {
    if (!window.confirm(`Are you sure you want to approve the room switch request for ${req.student_name} to Room ${req.requested_room}?`)) {
      return;
    }
    setSubmitting(true);
    try {
      const requestId = req.$id || req.id;
      // 1. Update the request status
      await updateDocument('hostelComplaints', requestId, {
        status: 'resolved',
        reply: 'Approved room switch'
      });

      // 2. Find and update the student profile
      try {
        const studentProfileDocs = await queryDocuments('students', [Query.equal('uid', req.student_id)]);
        if (studentProfileDocs.length > 0) {
          const studentDocId = studentProfileDocs[0].$id;
          await updateDocument('students', studentDocId, { room_number: req.requested_room });
        }
      } catch (err) {
        console.error('Failed to update student profile room number:', err);
      }

      // 3. Update the new room
      const newRoom = rooms.find(r => r.room_number === req.requested_room);
      if (newRoom) {
        const newOccupants = [...(newRoom.occupants || [])];
        if (!newOccupants.includes(req.student_id)) {
          newOccupants.push(req.student_id);
        }
        const newCount = Math.min(newRoom.capacity, newOccupants.length);
        await updateDocument('hostelRooms', newRoom.$id || newRoom.id, {
          occupants: newOccupants,
          occupied_count: newCount
        });
      }

      // 4. Update the old room
      if (req.current_room && req.current_room !== 'Not Assigned') {
        const oldRoom = rooms.find(r => r.room_number === req.current_room);
        if (oldRoom) {
          const oldOccupants = (oldRoom.occupants || []).filter(uid => uid !== req.student_id);
          const oldCount = Math.max(0, oldOccupants.length);
          await updateDocument('hostelRooms', oldRoom.$id || oldRoom.id, {
            occupants: oldOccupants,
            occupied_count: oldCount
          });
        }
      }

      toast.success('Room switch approved and student details updated successfully!');
      fetchRooms();
    } catch (err) {
      console.error(err);
      toast.error('Failed to approve room switch');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectSwitch = async (e) => {
    e.preventDefault();
    if (!rejectReason.trim()) {
      return toast.error('Please specify a rejection reason');
    }
    setSubmitting(true);
    try {
      const requestId = rejectingRequest.$id || rejectingRequest.id;
      await updateDocument('hostelComplaints', requestId, {
        status: 'rejected',
        reply: rejectReason.trim()
      });
      toast.success('Room switch request rejected');
      setShowRejectModal(false);
      setRejectReason('');
      setRejectingRequest(null);
      fetchRooms();
    } catch (err) {
      console.error(err);
      toast.error('Failed to reject request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddRoom = async (e) => {
    e.preventDefault();
    if (!form.room_number || !form.floor) {
      return toast.error('Room number and floor are required');
    }
    setSubmitting(true);
    try {
      const newRoom = {
        room_id: `room_${Date.now()}`,
        room_number: form.room_number.trim(),
        room_type: form.room_type,
        hostel_type: hostelType,
        floor: String(form.floor).trim(),
        capacity: parseInt(form.capacity, 10),
        occupied_count: 0,
        availability_status: 'available',
        attached_bathroom: form.attached_bathroom,
        ac_available: form.ac_available,
        description: form.description.trim()
      };
      await addDocument('hostelRooms', newRoom);
      toast.success('Room added successfully');
      setShowAddModal(false);
      resetForm();
      fetchRooms();
    } catch (err) {
      console.error('Add room error:', err);
      toast.error('Failed to add room');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditRoom = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const updateData = {
        room_type: form.room_type,
        floor: String(form.floor).trim(),
        capacity: parseInt(form.capacity, 10),
        attached_bathroom: form.attached_bathroom,
        ac_available: form.ac_available,
        description: form.description.trim(),
      };
      await updateDocument('hostelRooms', editingRoom.$id || editingRoom.id, updateData);
      toast.success('Room updated successfully');
      setShowEditModal(false);
      setEditingRoom(null);
      resetForm();
      fetchRooms();
    } catch (err) {
      console.error('Edit room error:', err);
      toast.error('Failed to update room');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRoom = async (id) => {
    if (!window.confirm('Are you sure you want to delete this room?')) return;
    try {
      await deleteDocument('hostelRooms', id);
      toast.success('Room deleted successfully');
      fetchRooms();
    } catch (err) {
      toast.error('Failed to delete room');
    }
  };

  const handleRemoveOccupant = async (studentUid, room) => {
    const student = allStudents.find(s => s.uid === studentUid);
    const studentName = student ? student.name : 'this student';
    if (!window.confirm(`Are you sure you want to remove ${studentName} from Room ${room.room_number}?`)) {
      return;
    }

    setSubmitting(true);
    try {
      // 1. Update student profile
      if (student) {
        await updateDocument('students', student.$id || student.id, {
          room_number: ''
        });
      }

      // 2. Update room occupants array
      const updatedOccupants = (room.occupants || []).filter(uid => uid !== studentUid);
      const updatedCount = Math.max(0, updatedOccupants.length);
      await updateDocument('hostelRooms', room.$id || room.id, {
        occupants: updatedOccupants,
        occupied_count: updatedCount
      });

      toast.success('Occupant removed successfully');
      fetchRooms();
    } catch (err) {
      console.error('Error removing occupant:', err);
      toast.error('Failed to remove occupant');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAllocateStudent = async (studentUid, targetRoom) => {
    const student = allStudents.find(s => s.uid === studentUid);
    if (!student) return;

    setSubmitting(true);
    try {
      // 1. If student was in another room, clean that up
      const oldRoomNumber = student.room_number;
      if (oldRoomNumber && oldRoomNumber !== 'Not Assigned') {
        const oldRoom = rooms.find(r => r.room_number === oldRoomNumber);
        if (oldRoom) {
          const oldOccupants = (oldRoom.occupants || []).filter(uid => uid !== studentUid);
          const oldCount = Math.max(0, oldOccupants.length);
          await updateDocument('hostelRooms', oldRoom.$id || oldRoom.id, {
            occupants: oldOccupants,
            occupied_count: oldCount
          });
        }
      }

      // 2. Update student profile with new room number
      await updateDocument('students', student.$id || student.id, {
        room_number: targetRoom.room_number
      });

      // 3. Update target room occupants list and count
      const targetOccupants = [...(targetRoom.occupants || [])];
      if (!targetOccupants.includes(studentUid)) {
        targetOccupants.push(studentUid);
      }
      const targetCount = Math.min(targetRoom.capacity, targetOccupants.length);
      await updateDocument('hostelRooms', targetRoom.$id || targetRoom.id, {
        occupants: targetOccupants,
        occupied_count: targetCount
      });

      toast.success(`Allocated ${student.name} to Room ${targetRoom.room_number}`);
      setShowAllocateModal(false);
      setAllocatingRoom(null);
      fetchRooms();
    } catch (err) {
      console.error('Allocation error:', err);
      toast.error('Failed to allocate student');
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (room) => {
    setEditingRoom(room);
    setForm({
      room_number: room.room_number,
      room_type: room.room_type || 'double',
      floor: room.floor || '',
      capacity: room.capacity || 2,
      attached_bathroom: room.attached_bathroom || false,
      ac_available: room.ac_available || false,
      description: room.description || '',
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setForm({
      room_number: '',
      room_type: 'double',
      floor: '',
      capacity: 2,
      attached_bathroom: false,
      ac_available: false,
      description: '',
    });
  };

  const handleRoomTypeChange = (type) => {
    const capacities = { single: 1, double: 2, triple: 3, suite: 4 };
    setForm(prev => ({
      ...prev,
      room_type: type,
      capacity: capacities[type] || 2
    }));
  };

  // Filter Rooms
  const filteredRooms = rooms.filter(r => {
    if (floorFilter !== 'all' && r.floor !== parseInt(floorFilter, 10)) return false;
    if (typeFilter !== 'all' && r.room_type !== typeFilter) return false;
    
    if (statusFilter !== 'all') {
      const occupied = r.occupied_count || 0;
      const cap = r.capacity || 1;
      if (statusFilter === 'available' && occupied >= cap) return false;
      if (statusFilter === 'full' && occupied < cap) return false;
      if (statusFilter === 'maintenance' && r.availability_status === 'maintenance') return false;
    }
    return true;
  });

  const getStatusLabel = (occupied, cap) => {
    if (occupied === 0) return { label: 'Empty', color: '#10b981', bg: '#d1fae5' };
    if (occupied >= cap) return { label: 'Full', color: '#ef4444', bg: '#fee2e2' };
    return { label: 'Available', color: '#f59e0b', bg: '#fef3c7' };
  };

  const glassCard = (extra = {}) => ({
    background: 'var(--surface-1)',
    borderRadius: 16,
    padding: 20,
    boxShadow: 'var(--shadow-md)',
    border: '1px solid var(--border)',
    transition: 'all 0.3s ease',
    position: 'relative',
    ...extra
  });

  if (loading) {
    return (
      <div className="loader-container" style={{ minHeight: '60vh' }}>
        <div className="loader" style={{ borderTopColor: accent }} />
        <p className="text-muted" style={{ fontSize: '0.85rem' }}>Loading room details...</p>
      </div>
    );
  }

  // =================== STUDENT VIEW ===================
  if (role === 'student') {
    // Browse all rooms for student
    const browsedRooms = rooms.filter(r => {
      // Apply filters
      const roomFloorInt = parseInt(r.floor, 10);
      if (studentFloorFilter !== 'all' && roomFloorInt !== parseInt(studentFloorFilter, 10)) return false;
      if (studentTypeFilter !== 'all' && r.room_type !== studentTypeFilter) return false;
      // Search
      if (searchRoom && !r.room_number.toLowerCase().includes(searchRoom.toLowerCase())) return false;
      
      // Vacancy Filter
      if (studentVacancyFilter !== 'all') {
        const occ = r.occupied_count || 0;
        const cap = r.capacity || 1;
        if (studentVacancyFilter === 'empty' && occ !== 0) return false;
        if (studentVacancyFilter === 'vacant' && (occ === 0 || occ >= cap)) return false;
        if (studentVacancyFilter === 'full' && occ < cap) return false;
      }
      return true;
    });

    const uniqueFloors = [...new Set(rooms.map(r => parseInt(r.floor, 10)))].sort((a, b) => a - b);
    const totalEmpty = rooms.filter(r => (r.occupied_count || 0) === 0).length;
    const totalAvailable = rooms.filter(r => (r.occupied_count || 0) < (r.capacity || 1)).length;

    return (
      <div style={{ padding: '24px 16px', maxWidth: 1100, margin: '0 auto', animation: 'fadeIn 0.4s ease' }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 className="page-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <MdHotel style={{ color: accent }} /> Room Allocation
          </h1>
          <p className="page-subtitle" style={{ margin: '4px 0 0' }}>
            View your assigned room, browse rooms & request a switch
          </p>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 6, marginBottom: 24,
          background: 'var(--surface-2)', padding: 6, borderRadius: 12, width: '100%',
          justifyContent: 'center', flexWrap: 'wrap'
        }}>
          <button
            onClick={() => setStudentTab('my-room')}
            style={{
              padding: '10px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s ease',
              background: studentTab === 'my-room' ? accent : 'transparent',
              color: studentTab === 'my-room' ? 'white' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap'
            }}
          >
            <MdKingBed /> My Room
          </button>
          <button
            onClick={() => setStudentTab('available')}
            style={{
              padding: '10px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s ease',
              background: studentTab === 'available' ? accent : 'transparent',
              color: studentTab === 'available' ? 'white' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap'
            }}
          >
            <MdSearch /> Browse Rooms
            <span style={{
              background: studentTab === 'available' ? 'rgba(255,255,255,0.25)' : 'var(--border)',
              padding: '1px 8px', borderRadius: 10, fontSize: '0.75rem', fontWeight: 700,
              marginLeft: 6
            }}>{rooms.length}</span>
          </button>
          {switchRequests.length > 0 && (
            <button
              onClick={() => setStudentTab('requests')}
              style={{
                padding: '10px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s ease',
                background: studentTab === 'requests' ? accent : 'transparent',
                color: studentTab === 'requests' ? 'white' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap'
              }}
            >
              <MdSwapHoriz /> My Requests
              <span style={{
                background: studentTab === 'requests' ? 'rgba(255,255,255,0.25)' : '#fef3c7',
                color: studentTab === 'requests' ? 'white' : '#f59e0b',
                padding: '1px 8px', borderRadius: 10, fontSize: '0.75rem', fontWeight: 700,
                marginLeft: 6
              }}>{switchRequests.length}</span>
            </button>
          )}
          <button
            onClick={() => setStudentTab('gallery')}
            style={{
              padding: '10px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s ease',
              background: studentTab === 'gallery' ? accent : 'transparent',
              color: studentTab === 'gallery' ? 'white' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap'
            }}
          >
            <MdPhotoLibrary /> Room Gallery
            <span style={{
              background: studentTab === 'gallery' ? 'rgba(255,255,255,0.25)' : 'var(--border)',
              padding: '1px 8px', borderRadius: 10, fontSize: '0.75rem', fontWeight: 700,
              marginLeft: 6
            }}>{galleryImages.length}</span>
          </button>
        </div>

        {/* ===== TAB: My Room ===== */}
        {studentTab === 'my-room' && (
          <>
            {myRoom ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
                {/* Room Details Card */}
                <div style={glassCard({ borderLeft: `5px solid ${accent}` })}>
                  <div style={{
                    position: 'absolute', top: 16, right: 16,
                    background: '#d1fae5', color: '#10b981',
                    padding: '4px 12px', borderRadius: 20,
                    fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
                    display: 'flex', alignItems: 'center', gap: 4
                  }}>
                    <MdCheckCircle /> Allocated
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{
                      fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase',
                      color: accent, background: accentLight, padding: '3px 10px', borderRadius: 20
                    }}>
                      Floor {myRoom.floor}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {myRoom.room_type?.toUpperCase()} SHARING
                    </span>
                  </div>

                  <h2 style={{ fontSize: '2.8rem', fontWeight: 900, margin: '8px 0 12px 0', color: 'var(--text)', letterSpacing: '-1px' }}>
                    Room {myRoom.room_number}
                  </h2>

                  <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
                    {myRoom.description || 'Modern campus room equipped with essential student amenities, storage spaces, and high-speed Wi-Fi access.'}
                  </p>

                  {/* Room Features */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
                    borderTop: '1px solid var(--border)', paddingTop: 16
                  }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 10
                    }}>
                      <MdBathtub style={{ color: accent, fontSize: '1.1rem' }} />
                      <div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Bathroom</div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                          {myRoom.attached_bathroom ? 'Attached' : 'Shared'}
                        </div>
                      </div>
                    </div>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 10
                    }}>
                      <MdAcUnit style={{ color: accent, fontSize: '1.1rem' }} />
                      <div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Cooling</div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                          {myRoom.ac_available ? 'AC Room' : 'Fan Only'}
                        </div>
                      </div>
                    </div>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 10
                    }}>
                      <MdPeople style={{ color: accent, fontSize: '1.1rem' }} />
                      <div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Capacity</div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                          {myRoom.occupied_count || 1} / {myRoom.capacity || 2} beds
                        </div>
                      </div>
                    </div>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 10
                    }}>
                      <MdWifi style={{ color: accent, fontSize: '1.1rem' }} />
                      <div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Internet</div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>Wi-Fi Enabled</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Roommates Card */}
                <div style={glassCard()}>
                  <h3 style={{
                    fontSize: '1rem', fontWeight: 700, margin: '0 0 16px 0',
                    borderBottom: '1px solid var(--border)', paddingBottom: 10,
                    display: 'flex', alignItems: 'center', gap: 8
                  }}>
                    <MdPeople style={{ color: accent }} />
                    Room Occupants ({myRoom.occupied_count || 1} / {myRoom.capacity || 2})
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* Current Student */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 14px', background: accentLight, borderRadius: 12,
                      border: `1px solid ${accent}22`
                    }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%', background: accent,
                        color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: '1rem', flexShrink: 0
                      }}>
                        {userProfile?.name?.charAt(0) || 'U'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)' }}>
                          {userProfile?.name || 'You'}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: accent }}>
                          {userProfile?.usn || 'Current User'} • You
                        </div>
                      </div>
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 600, background: accent,
                        color: 'white', padding: '2px 8px', borderRadius: 8
                      }}>You</span>
                    </div>

                    {/* Placeholder roommates */}
                    {Array.from({ length: Math.max(0, (myRoom.capacity || 2) - 1) }).map((_, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 12
                      }}>
                        <div style={{
                          width: 40, height: 40, borderRadius: '50%',
                          background: i < (myRoom.occupied_count || 1) - 1 ? '#6b7280' : 'var(--border)',
                          color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: '0.9rem', flexShrink: 0
                        }}>
                          {i < (myRoom.occupied_count || 1) - 1 ? 'R' : '?'}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text)' }}>
                            {i < (myRoom.occupied_count || 1) - 1 ? 'Roommate Assigned' : 'Bed Vacant'}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {i < (myRoom.occupied_count || 1) - 1 ? 'Verified Student' : 'Awaiting assignment'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Quick Action: Switch Room */}
                  <button
                    onClick={() => setStudentTab('available')}
                    style={{
                      marginTop: 20, width: '100%', padding: '12px 16px',
                      borderRadius: 12, border: `1px dashed ${accent}`,
                      background: 'transparent', cursor: 'pointer',
                      color: accent, fontSize: '0.84rem', fontWeight: 600,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = accentLight; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <MdSwapHoriz /> Request Room Switch
                  </button>
                </div>
              </div>
            ) : (
              <div style={glassCard({ textAlign: 'center', padding: '48px 24px' })}>
                <div style={{
                  width: 72, height: 72, borderRadius: '50%', margin: '0 auto 16px',
                  background: accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <MdHotel style={{ fontSize: '2rem', color: accent }} />
                </div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', fontWeight: 700 }}>Room Not Allocated Yet</h3>
                <p className="text-muted" style={{ maxWidth: 420, margin: '0 auto 20px', lineHeight: 1.6, fontSize: '0.88rem' }}>
                  Your hostel room allocation is pending. You can browse available rooms below and submit a request to the warden.
                </p>
                <button
                  onClick={() => setStudentTab('available')}
                  className="btn btn-primary"
                  style={{ background: accent, borderColor: accent, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <MdSearch /> Browse Available Rooms
                </button>
              </div>
            )}
          </>
        )}

        {/* ===== TAB: Available Rooms ===== */}
        {studentTab === 'available' && (
          <>
            {/* Stats Bar */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 12, marginBottom: 20
            }}>
              <div style={glassCard({ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 })}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <MdMeetingRoom style={{ color: '#10b981', fontSize: '1.2rem' }} />
                </div>
                <div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text)' }}>{totalEmpty}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>Empty Rooms</div>
                </div>
              </div>
              <div style={glassCard({ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 })}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <MdPeople style={{ color: '#f59e0b', fontSize: '1.2rem' }} />
                </div>
                <div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text)' }}>{totalAvailable - totalEmpty}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>Partially Filled</div>
                </div>
              </div>
              <div style={glassCard({ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 })}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <MdStairs style={{ color: accent, fontSize: '1.2rem' }} />
                </div>
                <div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text)' }}>{uniqueFloors.length}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>Total Floors</div>
                </div>
              </div>
            </div>

            {/* Search & Filter Bar */}
            <div style={{
              display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
              marginBottom: 16, padding: '12px 16px', borderRadius: 12,
              background: 'var(--surface-2)', border: '1px solid var(--border)'
            }}>
              <div style={{ position: 'relative', flex: '1 1 200px' }}>
                <MdSearch style={{
                  position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text-muted)', fontSize: '1.1rem'
                }} />
                <input
                  type="text"
                  placeholder="Search room number..."
                  value={searchRoom}
                  onChange={e => setSearchRoom(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 12px 8px 34px', borderRadius: 8,
                    border: '1px solid var(--border)', background: 'var(--surface-1)',
                    color: 'var(--text)', fontSize: '0.82rem', outline: 'none'
                  }}
                />
              </div>
              <select
                value={studentFloorFilter}
                onChange={e => setStudentFloorFilter(e.target.value)}
                style={{
                  padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
                  background: 'var(--surface-1)', color: 'var(--text)', fontSize: '0.82rem', outline: 'none'
                }}
              >
                <option value="all">All Floors</option>
                {uniqueFloors.map(f => <option key={f} value={f}>Floor {f}</option>)}
              </select>
              <select
                value={studentTypeFilter}
                onChange={e => setStudentTypeFilter(e.target.value)}
                style={{
                  padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
                  background: 'var(--surface-1)', color: 'var(--text)', fontSize: '0.82rem', outline: 'none'
                }}
              >
                <option value="all">All Types</option>
                <option value="single">Single</option>
                <option value="double">Double</option>
                <option value="triple">Triple</option>
                <option value="suite">Suite</option>
              </select>
              <select
                value={studentVacancyFilter}
                onChange={e => setStudentVacancyFilter(e.target.value)}
                style={{
                  padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
                  background: 'var(--surface-1)', color: 'var(--text)', fontSize: '0.82rem', outline: 'none'
                }}
              >
                <option value="all">All Vacancy Statuses</option>
                <option value="empty">Empty Rooms</option>
                <option value="vacant">Has Vacancies</option>
                <option value="full">Completely Full</option>
              </select>
              <span style={{ marginLeft: 'auto', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                {browsedRooms.length} rooms found
              </span>
            </div>

            {/* Status Legend */}
            <div style={{
              display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20,
              fontSize: '0.78rem', padding: '4px 8px', color: 'var(--text-muted)',
              borderBottom: '1px solid var(--border)', paddingBottom: 12
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }} /> Your Allocated Room
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} /> Empty (Fully Vacant)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} /> Partially Occupied
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} /> Fully Occupied
              </span>
            </div>

            {/* Room Cards Grid */}
            {browsedRooms.length === 0 ? (
              <div className="empty-state" style={{ marginTop: 40, padding: 40 }}>
                <div className="empty-icon"><MdMeetingRoom /></div>
                <h3>No Rooms Found</h3>
                <p className="text-muted">No rooms match the applied filters. Try adjusting your filter settings.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {browsedRooms.map(room => {
                  const occ = room.occupied_count || 0;
                  const cap = room.capacity || 2;
                  const isMyRoom = myRoom && room.room_number === myRoom.room_number;
                  
                  let sc = getStatusLabel(occ, cap);
                  if (isMyRoom) {
                    sc = { label: 'Allocated to You', color: '#3b82f6', bg: '#dbeafe' };
                  }
                  
                  const vacantBeds = cap - occ;
                  const alreadyRequested = switchRequests.some(r => r.requested_room === room.room_number && r.status === 'pending');
                  const canRequest = !isMyRoom && occ < cap && !alreadyRequested;

                  return (
                    <div
                      key={room.$id || room.room_id}
                      style={glassCard({ borderTop: `4px solid ${sc.color}`, cursor: 'default' })}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                    >
                      {/* Room Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)' }}>
                          Room {room.room_number}
                        </h3>
                        <span style={{
                          fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px',
                          borderRadius: 12, color: sc.color, background: sc.bg
                        }}>
                          {sc.label}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 14 }}>
                        Floor {room.floor} • {room.room_type?.charAt(0).toUpperCase() + room.room_type?.slice(1)} Sharing
                      </div>

                      {/* Occupancy Bar */}
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                          <span>{vacantBeds} bed{vacantBeds > 1 ? 's' : ''} vacant</span>
                          <span>{occ} out of {cap} occupied</span>
                        </div>
                        <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', width: `${(occ / cap) * 100}%`,
                            background: sc.color, borderRadius: 3, transition: 'width 0.4s ease'
                          }} />
                        </div>
                      </div>

                      {/* Amenity Tags */}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: '0.72rem', marginBottom: 16 }}>
                        <span style={{
                          display: 'flex', alignItems: 'center', gap: 3,
                          background: 'var(--surface-2)', padding: '3px 8px', borderRadius: 6
                        }}>
                          <MdBathtub style={{ fontSize: '0.85rem' }} />
                          {room.attached_bathroom ? 'Attached Bath' : 'Shared Bath'}
                        </span>
                        <span style={{
                          display: 'flex', alignItems: 'center', gap: 3,
                          background: 'var(--surface-2)', padding: '3px 8px', borderRadius: 6
                        }}>
                          <MdAcUnit style={{ fontSize: '0.85rem' }} />
                          {room.ac_available ? 'AC' : 'Non-AC'}
                        </span>
                        <span style={{
                          display: 'flex', alignItems: 'center', gap: 3,
                          background: 'var(--surface-2)', padding: '3px 8px', borderRadius: 6
                        }}>
                          <MdWifi style={{ fontSize: '0.85rem' }} /> Wi-Fi
                        </span>
                      </div>

                      {/* Request Switch Button */}
                      <button
                        disabled={!canRequest}
                        onClick={() => {
                          setSwitchTargetRoom(room);
                          setSwitchReason('');
                          setShowSwitchModal(true);
                        }}
                        style={{
                          width: '100%', padding: '10px 14px', borderRadius: 10,
                          border: 'none', cursor: !canRequest ? 'not-allowed' : 'pointer',
                          background: isMyRoom 
                            ? 'var(--surface-2)' 
                            : alreadyRequested 
                              ? 'var(--surface-2)'
                              : occ >= cap 
                                ? 'var(--surface-2)'
                                : `linear-gradient(135deg, ${accent}, ${accentDark})`,
                          color: !canRequest ? 'var(--text-muted)' : 'white',
                          fontSize: '0.82rem', fontWeight: 600,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          transition: 'all 0.2s ease',
                          opacity: !canRequest ? 0.7 : 1
                        }}
                        onMouseEnter={e => { if (canRequest) e.currentTarget.style.transform = 'scale(1.02)'; }}
                        onMouseLeave={e => { if (canRequest) e.currentTarget.style.transform = 'scale(1)'; }}
                      >
                        {isMyRoom ? (
                          <>Currently Allocated</>
                        ) : alreadyRequested ? (
                          <><MdAccessTime /> Request Pending</>
                        ) : occ >= cap ? (
                          <>Room Full</>
                        ) : (
                          <><MdSwapHoriz /> Request Switch</>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ===== TAB: My Requests ===== */}
        {studentTab === 'requests' && (
          <>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <MdSwapHoriz style={{ color: accent }} /> Room Switch Requests
              </h2>
              <p className="text-muted" style={{ margin: 0, fontSize: '0.82rem' }}>
                Track the status of your room switch requests
              </p>
            </div>

            {switchRequests.length === 0 ? (
              <div className="empty-state" style={{ marginTop: 40 }}>
                <div className="empty-icon"><MdSwapHoriz /></div>
                <h3>No Requests Yet</h3>
                <p className="text-muted">Browse available rooms and request a switch to get started.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {switchRequests.map((req, i) => {
                  const statusMap = {
                    pending: { label: 'Pending', color: '#f59e0b', bg: '#fef3c7', icon: <MdAccessTime /> },
                    in_progress: { label: 'In Progress', color: '#3b82f6', bg: '#dbeafe', icon: <MdSwapHoriz /> },
                    resolved: { label: 'Approved', color: '#10b981', bg: '#d1fae5', icon: <MdCheckCircle /> },
                    rejected: { label: 'Rejected', color: '#ef4444', bg: '#fee2e2', icon: <MdBlock /> },
                  };
                  const st = statusMap[req.status] || statusMap.pending;

                  return (
                    <div key={req.$id || i} style={glassCard({
                      display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px',
                      borderLeft: `4px solid ${st.color}`
                    })}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 12,
                        background: st.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: st.color, fontSize: '1.3rem', flexShrink: 0
                      }}>
                        {st.icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                          {req.current_room || '—'} <MdArrowForward style={{ verticalAlign: 'middle', fontSize: '0.9rem', color: accent }} /> {req.requested_room || '—'}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {req.message}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                          Submitted: {new Date(req.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                        {req.reply && (
                          <div style={{
                            marginTop: 8, padding: '8px 12px', background: st.bg,
                            borderRadius: 8, fontSize: '0.78rem', color: st.color, fontWeight: 500
                          }}>
                            Warden: {req.reply}
                          </div>
                        )}
                      </div>
                      <span style={{
                        fontSize: '0.72rem', fontWeight: 700, padding: '4px 12px',
                        borderRadius: 20, color: st.color, background: st.bg, whiteSpace: 'nowrap'
                      }}>
                        {st.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {studentTab === 'gallery' && (
          <>
            <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MdPhotoLibrary style={{ color: accent }} /> Hostel Room Showcase
                </h2>
                <p className="text-muted" style={{ margin: 0, fontSize: '0.82rem' }}>
                  Browse photos of different room configurations to see how the room looks
                </p>
              </div>

              {/* Quick Categories Filter */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['all', 'Single Room', '2 Sharing', '3 Sharing', '4 Sharing'].map(cat => {
                  const isActive = studentGalleryFilter === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setStudentGalleryFilter(cat)}
                      style={{
                        padding: '6px 14px', borderRadius: 20, border: isActive ? `1.5px solid ${accent}` : '1.5px solid var(--border)',
                        background: isActive ? accentLight : 'transparent',
                        color: isActive ? accentDark : 'var(--text-muted)',
                        fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s ease',
                        textTransform: 'capitalize'
                      }}
                    >
                      {cat === 'all' ? 'All Configurations' : cat}
                    </button>
                  );
                })}
              </div>
            </div>

            {galleryLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
                <div className="spinner" style={{ borderLeftColor: accent }} />
              </div>
            ) : galleryImages.length === 0 ? (
              <div className="empty-state" style={{ marginTop: 40, padding: 40 }}>
                <div className="empty-icon" style={{ background: accentLight, color: accent }}><MdPhotoLibrary /></div>
                <h3>No Photos Yet</h3>
                <p className="text-muted">The warden has not uploaded any room showcase photos yet.</p>
              </div>
            ) : (() => {
              const groupedList = getGroupedGallery(galleryImages);
              const filteredGroups = groupedList.filter(group => {
                if (studentGalleryFilter === 'all') return true;
                return group.room_type && group.room_type.toLowerCase().includes(studentGalleryFilter.toLowerCase());
              });

              if (filteredGroups.length === 0) {
                return (
                  <div className="empty-state" style={{ marginTop: 20, padding: 30 }}>
                    <h3>No matching photos</h3>
                    <p className="text-muted">No showcase photos found for configuration "{studentGalleryFilter}".</p>
                  </div>
                );
              }

              return (
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: 20, animation: 'fadeIn 0.3s ease'
                }}>
                  {filteredGroups.map((group, index) => {
                    const activeIdx = cardSlideIndices[group.room_id] || 0;
                    const activeImg = group.images[activeIdx] || group.images[0];
                    
                    const handlePrevSlide = (e) => {
                      e.stopPropagation();
                      const current = cardSlideIndices[group.room_id] || 0;
                      const prev = (current - 1 + group.images.length) % group.images.length;
                      setCardSlideIndices({ ...cardSlideIndices, [group.room_id]: prev });
                    };

                    const handleNextSlide = (e) => {
                      e.stopPropagation();
                      const current = cardSlideIndices[group.room_id] || 0;
                      const next = (current + 1) % group.images.length;
                      setCardSlideIndices({ ...cardSlideIndices, [group.room_id]: next });
                    };

                    return (
                      <div
                        key={group.room_id || index}
                        onClick={() => {
                          const flatIndex = galleryImages.findIndex(gi => gi.$id === activeImg.$id);
                          setLightboxIndex(flatIndex);
                        }}
                        style={glassCard({
                          padding: 0, borderRadius: 16, overflow: 'hidden', cursor: 'pointer',
                          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                          border: '1px solid var(--border)',
                          position: 'relative'
                        })}
                        onMouseEnter={e => {
                          e.currentTarget.style.transform = 'translateY(-4px)';
                          e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                          const buttons = e.currentTarget.querySelectorAll('.slide-ctrl-btn');
                          buttons.forEach(b => b.style.opacity = '1');
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = 'none';
                          const buttons = e.currentTarget.querySelectorAll('.slide-ctrl-btn');
                          buttons.forEach(b => b.style.opacity = '0');
                        }}
                      >
                        <div style={{ height: 180, width: '100%', position: 'relative', overflow: 'hidden', background: 'var(--surface-3)' }}>
                          <img
                            src={activeImg.image_url}
                            alt={group.room_type}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s ease' }}
                          />
                          
                          {/* Left/Right Slide Arrows */}
                          {group.images.length > 1 && (
                            <>
                              <button
                                className="slide-ctrl-btn"
                                onClick={handlePrevSlide}
                                style={{
                                  position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
                                  background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', color: 'white',
                                  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  cursor: 'pointer', zIndex: 10, opacity: 0, transition: 'all 0.2s ease'
                                }}
                              >
                                <MdChevronLeft style={{ fontSize: '1.4rem' }} />
                              </button>
                              <button
                                className="slide-ctrl-btn"
                                onClick={handleNextSlide}
                                style={{
                                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                                  background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', color: 'white',
                                  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  cursor: 'pointer', zIndex: 10, opacity: 0, transition: 'all 0.2s ease'
                                }}
                              >
                                <MdChevronRight style={{ fontSize: '1.4rem' }} />
                              </button>
                            </>
                          )}

                          {/* Image Slide Dots */}
                          {group.images.length > 1 && (
                            <div style={{
                              position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
                              display: 'flex', gap: 6, zIndex: 5, background: 'rgba(0,0,0,0.4)', padding: '4px 8px',
                              borderRadius: 10, backdropFilter: 'blur(2px)'
                            }}>
                              {group.images.map((_, i) => (
                                <div key={i} style={{
                                  width: 6, height: 6, borderRadius: '50%',
                                  background: activeIdx === i ? 'white' : 'rgba(255,255,255,0.4)',
                                  transition: 'all 0.2s ease'
                                }} />
                              ))}
                            </div>
                          )}

                          {/* Room Category Badge */}
                          <div style={{
                            position: 'absolute', top: 12, left: 12, zIndex: 5,
                            background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)',
                            color: 'white', padding: '4px 10px', borderRadius: 20,
                            fontSize: '0.72rem', fontWeight: 600
                          }}>
                            {group.room_type} {group.images.length > 1 && `(${group.images.length} Pics)`}
                          </div>
                        </div>
                        <div style={{ padding: 14 }}>
                          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text)', fontWeight: 500, lineHeight: 1.4 }}>
                            {group.caption}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </>
        )}

        {/* Gallery Lightbox Modal */}
        {lightboxIndex !== null && galleryImages.length > 0 && (
          <div
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)',
              backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 16,
              animation: 'fadeIn 0.2s ease'
            }}
            onClick={() => setLightboxIndex(null)}
          >
            {/* Close Button */}
            <button
              onClick={() => setLightboxIndex(null)}
              style={{
                position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.1)',
                border: 'none', borderRadius: '50%', width: 44, height: 44,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.5rem', color: 'white', cursor: 'pointer', transition: 'background 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            >
              <MdClose />
            </button>

            {/* Lightbox Main Content */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '100%', maxWidth: 900, flex: 1, position: 'relative'
            }} onClick={e => e.stopPropagation()}>
              
              {/* Prev Button */}
              {galleryImages.length > 1 && (
                <button
                  onClick={() => setLightboxIndex(prev => (prev === 0 ? galleryImages.length - 1 : prev - 1))}
                  style={{
                    position: 'absolute', left: -20, background: 'rgba(255,255,255,0.1)',
                    border: 'none', borderRadius: '50%', width: 48, height: 48,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '2rem', color: 'white', cursor: 'pointer', zIndex: 10
                  }}
                >
                  <MdChevronLeft />
                </button>
              )}

              {/* Image Container */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <img
                  src={galleryImages[lightboxIndex]?.image_url}
                  alt={galleryImages[lightboxIndex]?.room_type}
                  style={{
                    maxWidth: '100%', maxHeight: '70vh', borderRadius: 12,
                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)'
                  }}
                />
                
                {/* Info Overlay */}
                <div style={{
                  textAlign: 'center', maxWidth: 600, color: 'white',
                  background: 'rgba(0,0,0,0.6)', padding: '12px 24px', borderRadius: 12,
                  backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.08)'
                }}>
                  <span style={{
                    background: accent, color: 'white', fontSize: '0.72rem',
                    fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                    textTransform: 'uppercase', display: 'inline-block', marginBottom: 6
                  }}>
                    {galleryImages[lightboxIndex]?.room_type}
                  </span>
                  <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 500, lineHeight: 1.4 }}>
                    {galleryImages[lightboxIndex]?.caption}
                  </p>
                  <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>
                    Image {lightboxIndex + 1} of {galleryImages.length}
                  </div>
                </div>
              </div>

              {/* Next Button */}
              {galleryImages.length > 1 && (
                <button
                  onClick={() => setLightboxIndex(prev => (prev === galleryImages.length - 1 ? 0 : prev + 1))}
                  style={{
                    position: 'absolute', right: -20, background: 'rgba(255,255,255,0.1)',
                    border: 'none', borderRadius: '50%', width: 48, height: 48,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '2rem', color: 'white', cursor: 'pointer', zIndex: 10
                  }}
                >
                  <MdChevronRight />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Switch Request Modal */}
        {showSwitchModal && switchTargetRoom && (
          <div
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
              backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', zIndex: 1000, padding: 16
            }}
            onClick={() => setShowSwitchModal(false)}
          >
            <div
              style={{
                background: 'var(--surface-1)', borderRadius: 20, padding: 28,
                maxWidth: 460, width: '100%', border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-lg)', position: 'relative',
                animation: 'fadeIn 0.25s ease'
              }}
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setShowSwitchModal(false)}
                style={{
                  position: 'absolute', top: 14, right: 14, background: 'none',
                  border: 'none', fontSize: '1.3rem', color: 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              ><MdClose /></button>

              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', margin: '0 auto 12px',
                  background: accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <MdSwapHoriz style={{ fontSize: '1.6rem', color: accent }} />
                </div>
                <h2 style={{ margin: '0 0 4px 0', fontSize: '1.2rem', fontWeight: 800 }}>Request Room Switch</h2>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Your request will be reviewed by the warden
                </p>
              </div>

              {/* Transfer Visualization */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                padding: '14px 16px', background: 'var(--surface-2)', borderRadius: 12, marginBottom: 18
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 2 }}>Current</div>
                  <div style={{
                    fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)',
                    background: 'var(--surface-1)', padding: '6px 14px', borderRadius: 8,
                    border: '1px solid var(--border)'
                  }}>
                    {myRoom?.room_number || 'None'}
                  </div>
                </div>
                <MdArrowForward style={{ fontSize: '1.4rem', color: accent, flexShrink: 0 }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 2 }}>Requested</div>
                  <div style={{
                    fontSize: '1.1rem', fontWeight: 800, color: 'white',
                    background: accent, padding: '6px 14px', borderRadius: 8
                  }}>
                    {switchTargetRoom.room_number}
                  </div>
                </div>
              </div>

              {/* Room Info */}
              <div style={{
                display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: '0.74rem',
                color: 'var(--text-muted)', marginBottom: 16
              }}>
                <span style={{ background: 'var(--surface-2)', padding: '3px 8px', borderRadius: 6 }}>
                  Floor {switchTargetRoom.floor}
                </span>
                <span style={{ background: 'var(--surface-2)', padding: '3px 8px', borderRadius: 6 }}>
                  {switchTargetRoom.room_type?.charAt(0).toUpperCase() + switchTargetRoom.room_type?.slice(1)} Sharing
                </span>
                <span style={{ background: 'var(--surface-2)', padding: '3px 8px', borderRadius: 6 }}>
                  {(switchTargetRoom.capacity || 2) - (switchTargetRoom.occupied_count || 0)} bed(s) vacant
                </span>
                <span style={{ background: 'var(--surface-2)', padding: '3px 8px', borderRadius: 6 }}>
                  {switchTargetRoom.ac_available ? 'AC' : 'Non-AC'}
                </span>
              </div>

              {/* Reason Input */}
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Reason for Switch *</label>
                <textarea
                  className="form-control"
                  placeholder="e.g. Want to be closer to friends, need AC room, prefer lower floor..."
                  value={switchReason}
                  onChange={e => setSwitchReason(e.target.value)}
                  rows={3}
                  style={{ resize: 'vertical' }}
                  required
                />
              </div>

              {/* Submit */}
              <button
                onClick={handleSwitchRequest}
                disabled={submitting || !switchReason.trim()}
                className="btn btn-primary btn-block"
                style={{
                  background: accent, borderColor: accent,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  opacity: (!switchReason.trim() || submitting) ? 0.6 : 1
                }}
              >
                {submitting ? 'Submitting...' : <><MdSend /> Submit Request</>}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =================== WARDEN VIEW ===================
  return (
    <div style={{ padding: '24px 16px', maxWidth: 1100, margin: '0 auto', animation: 'fadeIn 0.4s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}>
        <div>
          <h1 className="page-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <MdHotel style={{ color: accent }} /> Room Directory
          </h1>
          <p className="page-subtitle" style={{ margin: '4px 0 0' }}>
            Manage room allocations, floor distributions and facilities for the {hostelType} block
          </p>
        </div>
        {wardenTab === 'directory' && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => { resetForm(); setShowAddModal(true); }}
            style={{ background: accent, borderColor: accent, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <MdAdd /> Add Room
          </button>
        )}
      </div>

      {/* Warden Tabs */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 24,
        background: 'var(--surface-2)', padding: 4, borderRadius: 12, width: 'fit-content'
      }}>
        <button
          onClick={() => setWardenTab('directory')}
          style={{
            padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s ease',
            background: wardenTab === 'directory' ? accent : 'transparent',
            color: wardenTab === 'directory' ? 'white' : 'var(--text-muted)',
            display: 'flex', alignItems: 'center', gap: 6
          }}
        >
          <MdMeetingRoom /> Room Directory
        </button>
        <button
          onClick={() => setWardenTab('switches')}
          style={{
            padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s ease',
            background: wardenTab === 'switches' ? accent : 'transparent',
            color: wardenTab === 'switches' ? 'white' : 'var(--text-muted)',
            display: 'flex', alignItems: 'center', gap: 6
          }}
        >
          <MdSwapHoriz /> Switch Requests
          {switchRequests.filter(r => r.status === 'pending').length > 0 && (
            <span style={{
              background: wardenTab === 'switches' ? 'rgba(255,255,255,0.25)' : '#fef3c7',
              color: wardenTab === 'switches' ? 'white' : '#f59e0b',
              padding: '1px 8px', borderRadius: 10, fontSize: '0.75rem', fontWeight: 700,
              marginLeft: 6
            }}>{switchRequests.filter(r => r.status === 'pending').length}</span>
          )}
        </button>
        <button
          onClick={() => setWardenTab('gallery')}
          style={{
            padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s ease',
            background: wardenTab === 'gallery' ? accent : 'transparent',
            color: wardenTab === 'gallery' ? 'white' : 'var(--text-muted)',
            display: 'flex', alignItems: 'center', gap: 6
          }}
        >
          <MdPhotoLibrary /> Room Gallery
        </button>
      </div>

      {wardenTab === 'directory' && (
        <>
          {/* Filter Bar */}
          <div style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            flexWrap: 'wrap',
            marginBottom: 24,
            padding: '12px 16px',
            borderRadius: 12,
            background: 'var(--surface-2)',
            border: '1px solid var(--border)'
          }}>
            <MdFilterList style={{ color: accent, fontSize: '1.2rem' }} />
            <select
              value={floorFilter}
              onChange={(e) => setFloorFilter(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-1)', color: 'var(--text)', fontSize: '0.82rem', outline: 'none' }}
            >
              <option value="all">All Floors</option>
              <option value="1">1st Floor</option>
              <option value="2">2nd Floor</option>
              <option value="3">3rd Floor</option>
              <option value="4">4th Floor</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-1)', color: 'var(--text)', fontSize: '0.82rem', outline: 'none' }}
            >
              <option value="all">All Types</option>
              <option value="single">Single Bed</option>
              <option value="double">Double Bed</option>
              <option value="triple">Triple Bed</option>
              <option value="suite">Four-sharing Suite</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-1)', color: 'var(--text)', fontSize: '0.82rem', outline: 'none' }}
            >
              <option value="all">All Statuses</option>
              <option value="available">Has Vacancy</option>
              <option value="full">Completely Full</option>
              <option value="maintenance">Under Maintenance</option>
            </select>
            <span style={{ marginLeft: 'auto', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Showing {filteredRooms.length} Rooms
            </span>
          </div>

          {/* Room Directory Grid */}
          {filteredRooms.length === 0 ? (
            <div className="empty-state" style={{ marginTop: 40 }}>
              <div className="empty-icon"><MdMeetingRoom /></div>
              <h3>No Rooms Seeded</h3>
              <p className="text-muted">No rooms match the applied dashboard filter settings.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>
              {filteredRooms.map((room) => {
                const occ = room.occupied_count || 0;
                const cap = room.capacity || 2;
                const sc = getStatusLabel(occ, cap);
                
                return (
                  <div
                    key={room.$id || room.room_id}
                    style={glassCard({ borderTop: `4px solid ${sc.color}` })}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <span style={{ fontSize: '1.25rem', fontWeight: 800 }}>Room {room.room_number}</span>
                      <span style={{
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: 20,
                        background: sc.bg,
                        color: sc.color
                      }}>
                        {sc.text}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.82rem', marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Floor:</span>
                        <span style={{ fontWeight: 600 }}>{room.floor} Floor</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Bed Type:</span>
                        <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{room.room_type} sharing</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Features:</span>
                        <span style={{ fontWeight: 600 }}>
                          {[room.ac_available && 'AC', room.attached_bathroom && 'Attached Bath'].filter(Boolean).join(', ') || 'Standard'}
                        </span>
                      </div>
                    </div>

                    {/* Occupancy bar */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 600, marginBottom: 4 }}>
                        <span>Occupants</span>
                        <span>{occ} out of {cap}</span>
                      </div>
                      <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(occ / cap) * 100}%`, background: sc.color, borderRadius: 3 }} />
                      </div>
                    </div>

                    {/* Room occupants list */}
                    {room.occupants && room.occupants.length > 0 && (
                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginBottom: 16 }}>
                        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>OCCUPIED BY:</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {room.occupants.map((occUid, idx) => {
                            const student = allStudents.find(s => s.uid === occUid);
                            const displayName = student ? `${student.name} (${student.usn})` : occUid;
                            return (
                              <div key={idx} style={{ fontSize: '0.8rem', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: accent, flexShrink: 0 }} />
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={displayName}>{displayName}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveOccupant(occUid, room)}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--danger)',
                                    cursor: 'pointer',
                                    padding: '2px 4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    fontSize: '0.85rem',
                                    borderRadius: 4,
                                    transition: 'background 0.2s'
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(220, 53, 69, 0.1)'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                  title={`Remove ${student?.name || 'occupant'}`}
                                >
                                  <MdClose />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Card Actions */}
                    <div style={{ display: 'flex', gap: 6, borderTop: '1px solid var(--border)', paddingTop: 12, flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ flex: 1, minWidth: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '5px 0' }}
                        onClick={() => openEdit(room)}
                      >
                        <MdEdit /> Edit
                      </button>
                      
                      {occ < cap && (
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ flex: 1.2, minWidth: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '5px 0', background: accent, borderColor: accent }}
                          onClick={() => { setAllocatingRoom(room); setAllocateSearch(''); setShowAllocateModal(true); }}
                        >
                          <MdAdd /> Allocate
                        </button>
                      )}
                      
                      <button
                        className="btn btn-outline btn-sm btn-danger"
                        style={{ flex: 0.8, minWidth: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '5px 0' }}
                        onClick={() => handleDeleteRoom(room.$id || room.room_id)}
                      >
                        <MdDelete /> Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {wardenTab === 'switches' && (
        <>
          {/* Switch Requests Tab for Warden */}
          <div style={{
            display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
            marginBottom: 24, padding: '12px 16px', borderRadius: 12,
            background: 'var(--surface-2)', border: '1px solid var(--border)'
          }}>
            <MdFilterList style={{ color: accent, fontSize: '1.2rem' }} />
            <select
              value={wardenFilterStatus}
              onChange={e => setWardenFilterStatus(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-1)', color: 'var(--text)', fontSize: '0.82rem', outline: 'none' }}
            >
              <option value="all">All Requests</option>
              <option value="pending">Pending</option>
              <option value="resolved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {/* List requests */}
          {(() => {
            const filteredRequests = switchRequests.filter(r => {
              if (wardenFilterStatus !== 'all' && r.status !== wardenFilterStatus) return false;
              return true;
            });

            if (filteredRequests.length === 0) {
              return (
                <div className="empty-state" style={{ marginTop: 40 }}>
                  <div className="empty-icon"><MdSwapHoriz /></div>
                  <h3>No Switch Requests</h3>
                  <p className="text-muted">No switch requests found matching the current filter.</p>
                </div>
              );
            }

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {filteredRequests.map((req, i) => {
                  const statusMap = {
                    pending: { label: 'Pending', color: '#f59e0b', bg: '#fef3c7', icon: <MdAccessTime /> },
                    resolved: { label: 'Approved', color: '#10b981', bg: '#d1fae5', icon: <MdCheckCircle /> },
                    rejected: { label: 'Rejected', color: '#ef4444', bg: '#fee2e2', icon: <MdBlock /> },
                  };
                  const st = statusMap[req.status] || statusMap.pending;

                  return (
                    <div key={req.$id || i} style={glassCard({
                      borderLeft: `4px solid ${st.color}`,
                      display: 'flex', flexDirection: 'column', gap: 12
                    })}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                        <div>
                          <h3 style={{ margin: '0 0 2px 0', fontSize: '1rem', fontWeight: 800 }}>
                            {req.student_name}
                          </h3>
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            USN: {req.student_usn} • Filed: {new Date(req.createdAt || req.$createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <span style={{
                          fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px',
                          borderRadius: 20, color: st.color, background: st.bg,
                          display: 'flex', alignItems: 'center', gap: 4
                        }}>
                          {st.icon} {st.label}
                        </span>
                      </div>

                      {/* Room change path */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        background: 'var(--surface-2)', padding: '8px 12px', borderRadius: 8,
                        width: 'fit-content', fontSize: '0.86rem', fontWeight: 600
                      }}>
                        <span>Room {req.current_room}</span>
                        <MdArrowForward style={{ color: accent }} />
                        <span style={{ color: accent }}>Room {req.requested_room}</span>
                      </div>

                      <p style={{ fontSize: '0.84rem', margin: 0, color: 'var(--text-muted)' }}>
                        <strong>Reason:</strong> {req.message}
                      </p>

                      {req.reply && (
                        <div style={{
                          padding: '8px 12px', background: st.bg, borderRadius: 8,
                          fontSize: '0.8rem', color: st.color, fontWeight: 500
                        }}>
                          <strong>Response Note:</strong> {req.reply}
                        </div>
                      )}

                      {/* Action buttons */}
                      {req.status === 'pending' && (
                        <div style={{
                          display: 'flex', gap: 8, borderTop: '1px solid var(--border)',
                          paddingTop: 12, justifyContent: 'flex-end', marginTop: 4
                        }}>
                          <button
                            className="btn btn-outline btn-sm"
                            style={{ color: 'var(--success)', borderColor: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}
                            onClick={() => handleApproveSwitch(req)}
                            disabled={submitting}
                          >
                            <MdCheckCircle /> Approve & Switch Room
                          </button>
                          <button
                            className="btn btn-outline btn-sm btn-danger"
                            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                            onClick={() => {
                              setRejectingRequest(req);
                              setRejectReason('');
                              setShowRejectModal(true);
                            }}
                            disabled={submitting}
                          >
                            <MdBlock /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </>
      )}

      {wardenTab === 'gallery' && (
        <>
          <div style={{
            display: 'flex',
            gap: 24,
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            animation: 'fadeIn 0.3s ease'
          }}>
            {/* Left Column: Upload Form */}
            <div style={{
              flex: '1 1 350px',
              ...glassCard({
                padding: 24,
                border: '1px solid var(--border)',
                borderRadius: 16
              })
            }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                <MdCloudUpload style={{ color: accent, fontSize: '1.3rem' }} /> Upload Showcase Photo
              </h3>
              <form onSubmit={handleUploadGalleryImage}>
                {/* Room Type Category select */}
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 6 }}>Room Category *</label>
                  <select
                    className="form-control"
                    style={{ fontSize: '0.85rem', padding: '8px 12px' }}
                    value={galleryForm.room_type}
                    onChange={e => setGalleryForm({ ...galleryForm, room_type: e.target.value })}
                  >
                    <option value="Single Room">Single Room</option>
                    <option value="2 Sharing AC">2 Sharing AC</option>
                    <option value="2 Sharing Non AC">2 Sharing Non AC</option>
                    <option value="3 Sharing AC">3 Sharing AC</option>
                    <option value="3 Sharing Non AC">3 Sharing Non AC</option>
                    <option value="4 Sharing">4 Sharing</option>
                    <option value="Custom Room Type">Custom Room Type...</option>
                  </select>
                </div>

                {/* Conditional Custom Room Type Input */}
                {galleryForm.room_type === 'Custom Room Type' && (
                  <div className="form-group" style={{ marginBottom: 16, animation: 'slideDown 0.2s ease' }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 6 }}>Specify Room Category *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. 5 Sharing Suite, Deluxe AC"
                      value={galleryForm.customRoomType}
                      onChange={e => setGalleryForm({ ...galleryForm, customRoomType: e.target.value })}
                      required
                    />
                  </div>
                )}

                {/* Caption Textarea */}
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 6 }}>Photo Description / Caption</label>
                  <textarea
                    className="form-control"
                    placeholder="Describe the room features, study space, beds, layout, etc..."
                    style={{ minHeight: 80, fontSize: '0.85rem', padding: '8px 12px', resize: 'vertical' }}
                    value={galleryForm.caption}
                    onChange={e => setGalleryForm({ ...galleryForm, caption: e.target.value })}
                  />
                </div>

                {/* Drag-and-drop Image Upload Input */}
                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 6 }}>Room Photos *</label>
                  {!galleryForm.files || galleryForm.files.length === 0 ? (
                    <label style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      padding: '24px 16px', border: `2px dashed var(--border)`, borderRadius: 12,
                      cursor: 'pointer', transition: 'all 0.2s ease', background: 'var(--surface-2)',
                      textAlign: 'center'
                    }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = accent}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                    >
                      <MdPhotoLibrary style={{ color: 'var(--text-muted)', fontSize: '2rem', marginBottom: 8 }} />
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>Choose Showcase Photos</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>PNG, JPG or JPEG (select multiple)</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        style={{ display: 'none' }}
                        onChange={e => {
                          const selectedFiles = Array.from(e.target.files);
                          if (selectedFiles.length > 0) {
                            const newFiles = selectedFiles.map(file => ({
                              id: `${file.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                              file,
                              url: URL.createObjectURL(file)
                            }));
                            setGalleryForm(prev => ({
                              ...prev,
                              files: [...prev.files, ...newFiles]
                            }));
                          }
                        }}
                        required
                      />
                    </label>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {/* Grid of previews */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                        gap: 10,
                        maxHeight: '220px',
                        overflowY: 'auto',
                        padding: 8,
                        border: '1px solid var(--border)',
                        borderRadius: 12,
                        background: 'var(--surface-2)'
                      }}>
                        {galleryForm.files.map(fileObj => (
                          <div key={fileObj.id} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', height: 80, border: '1px solid var(--border)' }}>
                            <img src={fileObj.url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <button
                              type="button"
                              onClick={() => {
                                URL.revokeObjectURL(fileObj.url);
                                setGalleryForm(prev => ({
                                  ...prev,
                                  files: prev.files.filter(f => f.id !== fileObj.id)
                                }));
                              }}
                              style={{
                                position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', border: 'none',
                                borderRadius: '50%', color: 'white', width: 20, height: 20, display: 'flex',
                                alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '0.8rem',
                                transition: 'background 0.2s ease'
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = '#ef4444'}
                              onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.6)'}
                            >
                              <MdClose />
                            </button>
                          </div>
                        ))}
                        
                        {/* Add more button thumbnail */}
                        <label style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          border: `2px dashed var(--border)`, borderRadius: 8, cursor: 'pointer', height: 80,
                          background: 'var(--surface-1)', transition: 'all 0.2s ease'
                        }}
                          onMouseEnter={e => e.currentTarget.style.borderColor = accent}
                          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                        >
                          <MdAdd style={{ color: 'var(--text-muted)', fontSize: '1.5rem' }} />
                          <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)' }}>Add Pics</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            style={{ display: 'none' }}
                            onChange={e => {
                              const selectedFiles = Array.from(e.target.files);
                              if (selectedFiles.length > 0) {
                                const newFiles = selectedFiles.map(file => ({
                                  id: `${file.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                                  file,
                                  url: URL.createObjectURL(file)
                                }));
                                setGalleryForm(prev => ({
                                  ...prev,
                                  files: [...prev.files, ...newFiles]
                                }));
                              }
                            }}
                          />
                        </label>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0 4px' }}>
                        <span>{galleryForm.files.length} image(s) selected</span>
                        <button 
                          type="button" 
                          onClick={() => {
                            galleryForm.files.forEach(f => URL.revokeObjectURL(f.url));
                            setGalleryForm(prev => ({ ...prev, files: [] }));
                          }}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 600 }}
                        >
                          Clear All
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Upload Button */}
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 8, background: accent, borderColor: accent, fontWeight: 600, padding: '10px 16px'
                  }}
                  disabled={uploadingGallery || !galleryForm.files || galleryForm.files.length === 0}
                >
                  {uploadingGallery ? (
                    <>
                      <div className="spinner-sm" style={{ borderLeftColor: 'white' }} /> {uploadProgressText || 'Uploading...'}
                    </>
                  ) : (
                    <>
                      <MdCloudUpload /> {galleryForm.files && galleryForm.files.length > 0 
                        ? `Upload ${galleryForm.files.length} Showcase Photos` 
                        : 'Upload Showcase Photos'}
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Right Column: Existing showcase photos */}
            <div style={{ flex: '2 1 600px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Category Quick Filter */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap',
                gap: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)'
              }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Showcase Gallery ({galleryImages.length} Photos)</h3>
                
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {['all', 'Single Room', '2 Sharing', '3 Sharing', '4 Sharing'].map(cat => {
                    const isActive = studentGalleryFilter === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => setStudentGalleryFilter(cat)}
                        style={{
                          padding: '5px 12px', borderRadius: 20, border: isActive ? `1.5px solid ${accent}` : '1.5px solid var(--border)',
                          background: isActive ? accentLight : 'transparent',
                          color: isActive ? accentDark : 'var(--text-muted)',
                          fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s ease',
                          textTransform: 'capitalize'
                        }}
                      >
                        {cat === 'all' ? 'All' : cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {galleryLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
                  <div className="spinner" style={{ borderLeftColor: accent }} />
                </div>
              ) : galleryImages.length === 0 ? (
                <div className="empty-state" style={{ padding: 48, background: 'var(--surface-2)', borderRadius: 16 }}>
                  <div className="empty-icon" style={{ background: accentLight, color: accent }}><MdPhotoLibrary /></div>
                  <h3>No Photos Uploaded</h3>
                  <p className="text-muted">Use the upload panel to add room photos for students to view.</p>
                </div>
              ) : (() => {
                const groupedList = getGroupedGallery(galleryImages);
                const filteredGroups = groupedList.filter(group => {
                  if (studentGalleryFilter === 'all') return true;
                  return group.room_type && group.room_type.toLowerCase().includes(studentGalleryFilter.toLowerCase());
                });

                if (filteredGroups.length === 0) {
                  return (
                    <div className="empty-state" style={{ padding: 32, background: 'var(--surface-2)', borderRadius: 16 }}>
                      <h3>No matching photos</h3>
                      <p className="text-muted">No showcase photos found for category "{studentGalleryFilter}".</p>
                    </div>
                  );
                }

                return (
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                    gap: 16, animation: 'fadeIn 0.2s ease'
                  }}>
                    {filteredGroups.map((group, index) => {
                      const activeIdx = cardSlideIndices[group.room_id] || 0;
                      const activeImg = group.images[activeIdx] || group.images[0];
                      
                      const handlePrevSlide = (e) => {
                        e.stopPropagation();
                        const current = cardSlideIndices[group.room_id] || 0;
                        const prev = (current - 1 + group.images.length) % group.images.length;
                        setCardSlideIndices({ ...cardSlideIndices, [group.room_id]: prev });
                      };

                      const handleNextSlide = (e) => {
                        e.stopPropagation();
                        const current = cardSlideIndices[group.room_id] || 0;
                        const next = (current + 1) % group.images.length;
                        setCardSlideIndices({ ...cardSlideIndices, [group.room_id]: next });
                      };

                      return (
                        <div
                          key={group.room_id || index}
                          style={glassCard({
                            padding: 0, borderRadius: 12, overflow: 'hidden', position: 'relative',
                            border: '1px solid var(--border)', cursor: 'pointer',
                            transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                          })}
                          onMouseEnter={e => {
                            e.currentTarget.style.transform = 'translateY(-4px)';
                            e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                            const deleteBtn = e.currentTarget.querySelector('.gallery-delete-btn');
                            if (deleteBtn) deleteBtn.style.opacity = '1';
                            const buttons = e.currentTarget.querySelectorAll('.slide-ctrl-btn');
                            buttons.forEach(b => b.style.opacity = '1');
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                            const deleteBtn = e.currentTarget.querySelector('.gallery-delete-btn');
                            if (deleteBtn) deleteBtn.style.opacity = '0';
                            const buttons = e.currentTarget.querySelectorAll('.slide-ctrl-btn');
                            buttons.forEach(b => b.style.opacity = '0');
                          }}
                          onClick={() => {
                            const flatIndex = galleryImages.findIndex(gi => gi.$id === activeImg.$id);
                            setLightboxIndex(flatIndex);
                          }}
                        >
                          {/* Room Image */}
                          <div style={{ height: 180, width: '100%', position: 'relative', overflow: 'hidden', background: 'var(--surface-3)' }}>
                            <img src={activeImg.image_url} alt={group.room_type} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

                            {/* Left/Right Slide Arrows */}
                            {group.images.length > 1 && (
                              <>
                                <button
                                  className="slide-ctrl-btn"
                                  onClick={handlePrevSlide}
                                  style={{
                                    position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
                                    background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', color: 'white',
                                    width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', zIndex: 10, opacity: 0, transition: 'all 0.2s ease'
                                  }}
                                >
                                  <MdChevronLeft style={{ fontSize: '1.2rem' }} />
                                </button>
                                <button
                                  className="slide-ctrl-btn"
                                  onClick={handleNextSlide}
                                  style={{
                                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                                    background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', color: 'white',
                                    width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', zIndex: 10, opacity: 0, transition: 'all 0.2s ease'
                                  }}
                                >
                                  <MdChevronRight style={{ fontSize: '1.2rem' }} />
                                </button>
                              </>
                            )}

                            {/* Image Slide Dots */}
                            {group.images.length > 1 && (
                              <div style={{
                                position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
                                display: 'flex', gap: 6, zIndex: 5, background: 'rgba(0,0,0,0.4)', padding: '4px 8px',
                                borderRadius: 10, backdropFilter: 'blur(2px)'
                              }}>
                                {group.images.map((_, i) => (
                                  <div key={i} style={{
                                    width: 5, height: 5, borderRadius: '50%',
                                    background: activeIdx === i ? 'white' : 'rgba(255,255,255,0.4)',
                                    transition: 'all 0.2s ease'
                                  }} />
                                ))}
                              </div>
                            )}

                            {/* Room Type Category Badge */}
                            <span style={{
                              position: 'absolute', top: 10, left: 10, background: 'rgba(0,0,0,0.65)',
                              backdropFilter: 'blur(4px)', color: 'white', padding: '3px 10px', zIndex: 5,
                              borderRadius: 20, fontSize: '0.7rem', fontWeight: 700, pointerEvents: 'none'
                            }}>
                              {group.room_type} {group.images.length > 1 && `(${group.images.length} Pics)`}
                            </span>

                            {/* Interactive Delete Button Overlay */}
                            <button
                              className="gallery-delete-btn"
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteGalleryImage(group);
                              }}
                              style={{
                                position: 'absolute', top: 10, right: 10, background: 'rgba(239, 68, 68, 0.9)',
                                border: 'none', borderRadius: '50%', color: 'white', width: 32, height: 32,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 12,
                                fontSize: '1rem', transition: 'all 0.2s ease', opacity: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                              }}
                              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                              title="Delete this room showcase"
                            >
                              <MdDelete />
                            </button>
                          </div>

                          {/* Caption below picture */}
                          <div style={{ padding: '10px 14px' }}>
                            <p style={{
                              margin: 0, fontSize: '0.8rem', color: 'var(--text)', fontWeight: 500,
                              lineHeight: 1.4
                            }}>
                              {group.caption}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </>
      )}

      {/* Modal - Add Room */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={() => setShowAddModal(false)}>
          <div style={{ background: 'var(--surface-1)', borderRadius: 16, padding: 24, maxWidth: 450, width: '100%', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowAddModal(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', fontSize: '1.2rem', color: 'var(--text-muted)', cursor: 'pointer' }}><MdClose /></button>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', fontWeight: 800 }}><MdHotel style={{ color: accent, verticalAlign: 'middle', marginRight: 6 }} /> Add New Room</h2>
            
            <form onSubmit={handleAddRoom}>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Room Number *</label>
                <input type="text" className="form-control" placeholder="e.g. 101, B-204" value={form.room_number} onChange={e => setForm({ ...form, room_number: e.target.value })} required />
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Floor *</label>
                <input type="number" className="form-control" placeholder="e.g. 1, 2, 3" min="1" value={form.floor} onChange={e => setForm({ ...form, floor: e.target.value })} required />
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Room Bedding Type *</label>
                <select className="form-control" value={form.room_type} onChange={e => handleRoomTypeChange(e.target.value)}>
                  <option value="single">Single sharing</option>
                  <option value="double">Double sharing</option>
                  <option value="triple">Triple sharing</option>
                  <option value="suite">Four-sharing Suite</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: 20, margin: '14px 0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.attached_bathroom} onChange={e => setForm({ ...form, attached_bathroom: e.target.checked })} style={{ accentColor: accent }} />
                  Attached Bathroom
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.ac_available} onChange={e => setForm({ ...form, ac_available: e.target.checked })} style={{ accentColor: accent }} />
                  AC Equipped
                </label>
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label">Description (Optional)</label>
                <textarea className="form-control" placeholder="Brief room detail notes..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
              </div>

              <button type="submit" className="btn btn-primary btn-block" style={{ background: accent, borderColor: accent }} disabled={submitting}>
                {submitting ? 'Adding...' : 'Confirm Room Entry'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal - Edit Room */}
      {showEditModal && editingRoom && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={() => setShowEditModal(false)}>
          <div style={{ background: 'var(--surface-1)', borderRadius: 16, padding: 24, maxWidth: 450, width: '100%', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowEditModal(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', fontSize: '1.2rem', color: 'var(--text-muted)', cursor: 'pointer' }}><MdClose /></button>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', fontWeight: 800 }}><MdEdit style={{ color: accent, verticalAlign: 'middle', marginRight: 6 }} /> Edit Room {editingRoom.room_number}</h2>
            
            <form onSubmit={handleEditRoom}>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Floor *</label>
                <input type="number" className="form-control" min="1" value={form.floor} onChange={e => setForm({ ...form, floor: e.target.value })} required />
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Room Bedding Type *</label>
                <select className="form-control" value={form.room_type} onChange={e => handleRoomTypeChange(e.target.value)}>
                  <option value="single">Single sharing</option>
                  <option value="double">Double sharing</option>
                  <option value="triple">Triple sharing</option>
                  <option value="suite">Four-sharing Suite</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: 20, margin: '14px 0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.attached_bathroom} onChange={e => setForm({ ...form, attached_bathroom: e.target.checked })} style={{ accentColor: accent }} />
                  Attached Bathroom
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.ac_available} onChange={e => setForm({ ...form, ac_available: e.target.checked })} style={{ accentColor: accent }} />
                  AC Equipped
                </label>
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label">Description (Optional)</label>
                <textarea className="form-control" placeholder="Brief room detail notes..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
              </div>

              <button type="submit" className="btn btn-primary btn-block" style={{ background: accent, borderColor: accent }} disabled={submitting}>
                {submitting ? 'Updating...' : 'Save Room Settings'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal - Reject Switch Request */}
      {showRejectModal && rejectingRequest && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={() => setShowRejectModal(false)}>
          <div style={{ background: 'var(--surface-1)', borderRadius: 16, padding: 24, maxWidth: 450, width: '100%', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowRejectModal(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', fontSize: '1.2rem', color: 'var(--text-muted)', cursor: 'pointer' }}><MdClose /></button>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '1.15rem', fontWeight: 800 }}><MdBlock style={{ color: 'var(--danger)', verticalAlign: 'middle', marginRight: 6 }} /> Reject Switch Request</h2>
            <p className="text-muted" style={{ margin: '0 0 16px 0', fontSize: '0.8rem' }}>Please enter the reason for rejecting {rejectingRequest.student_name}'s room switch request.</p>
            
            <form onSubmit={handleRejectSwitch}>
              <div className="form-group" style={{ marginBottom: 18 }}>
                <textarea
                  className="form-control"
                  rows={4}
                  placeholder="e.g. Requested room is reserved for medical emergency, floor mismatch, etc..."
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowRejectModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm btn-danger" disabled={submitting}>
                  {submitting ? 'Rejecting...' : 'Reject Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal - Allocate Room */}
      {showAllocateModal && allocatingRoom && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={() => { setShowAllocateModal(false); setAllocatingRoom(null); }}>
          <div style={{ background: 'var(--surface-1)', borderRadius: 16, padding: 24, maxWidth: 500, width: '100%', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)', position: 'relative', display: 'flex', flexDirection: 'column', maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => { setShowAllocateModal(false); setAllocatingRoom(null); }} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', fontSize: '1.2rem', color: 'var(--text-muted)', cursor: 'pointer' }}><MdClose /></button>
            
            <h2 style={{ margin: '0 0 4px 0', fontSize: '1.2rem', fontWeight: 800 }}>
              <MdHotel style={{ color: accent, verticalAlign: 'middle', marginRight: 6 }} /> 
              Allocate Room {allocatingRoom.room_number}
            </h2>
            <p className="text-muted" style={{ margin: '0 0 16px 0', fontSize: '0.8rem' }}>
              Assign a student to Room {allocatingRoom.room_number} ({allocatingRoom.room_type} sharing, Floor {allocatingRoom.floor}). 
              Vacancies: {(allocatingRoom.capacity || 2) - (allocatingRoom.occupied_count || 0)} bed(s) left.
            </p>

            {/* Search Input */}
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <input
                type="text"
                className="form-control"
                style={{ paddingLeft: 34, fontSize: '0.86rem' }}
                placeholder="Search student by name or USN..."
                value={allocateSearch}
                onChange={e => setAllocateSearch(e.target.value)}
              />
              <MdSearch style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1.1rem' }} />
            </div>

            {/* Student List */}
            <div style={{ overflowY: 'auto', flex: 1, paddingRight: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(() => {
                // Filter students
                const query = allocateSearch.toLowerCase().trim();
                const filtered = allStudents.filter(student => {
                  if (!query) return true;
                  return (
                    student.name?.toLowerCase().includes(query) ||
                    student.usn?.toLowerCase().includes(query)
                  );
                });

                if (filtered.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      No students found matching search.
                    </div>
                  );
                }

                return filtered.map(student => {
                  const isAssigned = student.room_number && student.room_number !== 'Not Assigned';
                  const isInThisRoom = student.room_number === allocatingRoom.room_number;
                  
                  return (
                    <div
                      key={student.$id || student.id}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        background: 'var(--surface-2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                        <span style={{ fontSize: '0.86rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={student.name}>
                          {student.name}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {student.usn} • {isAssigned ? `Room ${student.room_number}` : 'Unassigned'}
                        </span>
                      </div>
                      
                      {isInThisRoom ? (
                        <span style={{ fontSize: '0.74rem', color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <MdCheckCircle /> Assigned
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{
                            padding: '4px 10px',
                            fontSize: '0.75rem',
                            background: isAssigned ? 'transparent' : accent,
                            borderColor: isAssigned ? 'var(--border)' : accent,
                            color: isAssigned ? 'var(--text)' : 'white'
                          }}
                          disabled={submitting}
                          onClick={() => handleAllocateStudent(student.uid || student.id, allocatingRoom)}
                        >
                          {isAssigned ? 'Reassign' : 'Allocate'}
                        </button>
                      )}
                    </div>
                  );
                });
              })()}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => { setShowAllocateModal(false); setAllocatingRoom(null); }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
