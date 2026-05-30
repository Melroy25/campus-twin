import { useState, useEffect, useMemo, useRef } from 'react';
import { queryDocuments, addDocument, updateDocument } from '../../appwrite/database';
import { uploadFile } from '../../appwrite/storage';
import { Query } from 'appwrite';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import {
  MdReceipt,
  MdAttachMoney,
  MdCalendarToday,
  MdCheckCircle,
  MdWarning,
  MdError,
  MdAdd,
  MdFilterList,
  MdSelectAll,
  MdClose,
  MdPayment,
  MdTrendingUp,
  MdPendingActions,
  MdDoneAll,
  MdDownload,
  MdUpload,
  MdQrCode,
  MdPeople,
  MdSearch,
  MdContentCopy,
} from 'react-icons/md';

const SEMESTERS = [
  '1st Semester', '2nd Semester', '3rd Semester', '4th Semester',
  '5th Semester', '6th Semester', '7th Semester', '8th Semester'
];

export default function HostelBills({ hostelType, role }) {
  const { userProfile } = useAuth();
  const accent = hostelType === 'girls' ? '#ec4899' : '#3b82f6';
  const accentLight = hostelType === 'girls' ? '#fce7f3' : '#dbeafe';
  const accentDark = hostelType === 'girls' ? '#be185d' : '#1e40af';

  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterSemester, setFilterSemester] = useState('all');
  const [submitting, setSubmitting] = useState(false);

  // Add bill form state
  const [billAmount, setBillAmount] = useState('');
  const [billMonth, setBillMonth] = useState('');
  const [billDueDate, setBillDueDate] = useState('');
  const [billDescription, setBillDescription] = useState('');

  // Students list for multi-select add bill
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [studentSemFilter, setStudentSemFilter] = useState('all');
  const [studentRoomTypeFilter, setStudentRoomTypeFilter] = useState('all');
  const [studentAcFilter, setStudentAcFilter] = useState('all');
  const [studentBathroomFilter, setStudentBathroomFilter] = useState('all');
  const [studentSearch, setStudentSearch] = useState('');

  // Account settings states
  const [accountDetails, setAccountDetails] = useState({
    bank_name: 'State Bank of India',
    account_number: '123456789012',
    ifsc_code: 'SBIN0001234',
    upi_id: 'hostelwarden@upi',
    qr_image_url: ''
  });
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [qrFilePreview, setQrFilePreview] = useState('');
  const [qrFileObj, setQrFileObj] = useState(null);

  // Student proof states
  const [showProofModal, setShowProofModal] = useState(false);
  const [selectedBillForProof, setSelectedBillForProof] = useState(null);
  const [transactionId, setTransactionId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [receiptFile, setReceiptFile] = useState(null);

  // Warden verify states
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [selectedBillForVerify, setSelectedBillForVerify] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const studentId = userProfile?.uid || '';
  const qrCanvasRef = useRef(null);

  // ─── Data fetching ───
  const fetchBills = async () => {
    setLoading(true);
    try {
      const queries =
        role === 'student'
          ? [Query.equal('student_id', studentId), Query.equal('hostel_type', hostelType)]
          : [Query.equal('hostel_type', hostelType)];
      const data = await queryDocuments('hostelBills', queries);
      // Auto-detect overdue bills
      const today = new Date().toISOString().split('T')[0];
      const processed = data.map((b) => {
        if (b.status === 'unpaid' && b.due_date && b.due_date < today) {
          return { ...b, status: 'overdue' };
        }
        return b;
      });
      setBills(processed);
    } catch (err) {
      toast.error('Failed to load bills');
    } finally {
      setLoading(false);
    }
  };

  const fetchAccountDetails = async () => {
    setLoadingAccount(true);
    try {
      const data = await queryDocuments('hostelNotices', [
        Query.equal('title', `account_settings_${hostelType}`),
        Query.equal('hostel_type', hostelType)
      ]);
      if (data && data.length > 0) {
        const parsed = JSON.parse(data[0].content);
        setAccountDetails(parsed);
      }
    } catch (err) {
      console.warn("Failed to load account details:", err);
    } finally {
      setLoadingAccount(false);
    }
  };

  const fetchStudents = async () => {
    setLoadingStudents(true);
    try {
      const data = await queryDocuments('students', [
        Query.equal('hostel_type', hostelType)
      ]);
      
      // Fetch all classes to map class_id to semester
      let classesList = [];
      try {
        classesList = await queryDocuments('classes', []);
      } catch (classErr) {
        console.warn("Failed to load classes for mapping:", classErr);
      }

      // Fetch all rooms to map student room details for billing filters
      let roomsList = [];
      try {
        roomsList = await queryDocuments('hostelRooms', [
          Query.equal('hostel_type', hostelType)
        ]);
      } catch (roomErr) {
        console.warn("Failed to load rooms for mapping:", roomErr);
      }

      // Merge student class_id with corresponding class semester & room details
      const mappedStudents = data.map((student) => {
        const cls = classesList.find((c) => (c.id || c.$id) === student.class_id);
        const room = student.room_number ? roomsList.find((r) => r.room_number === student.room_number) : null;
        return {
          ...student,
          semester: cls ? cls.semester : '',
          room_type: room ? (room.room_type || '') : '',
          capacity: room ? (room.capacity || 0) : 0,
          ac_available: room ? !!room.ac_available : false,
          attached_bathroom: room ? !!room.attached_bathroom : false
        };
      });

      setStudents(mappedStudents);
    } catch (err) {
      console.warn("Failed to load students:", err);
      toast.error('Failed to load student list');
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    fetchBills();
    fetchAccountDetails();
  }, [hostelType, role]);

  // ─── Derived data ───
  const uniqueMonths = useMemo(() => {
    const months = [...new Set(bills.map((b) => b.billing_month).filter(Boolean))];
    return months.sort();
  }, [bills]);

  const uniqueSemesters = useMemo(() => {
    const sems = [...new Set(bills.map((b) => b.semester).filter(Boolean))];
    return sems.sort();
  }, [bills]);

  const filteredBills = useMemo(() => {
    return bills.filter((b) => {
      if (filterStatus !== 'all' && b.status !== filterStatus) return false;
      if (filterMonth !== 'all' && b.billing_month !== filterMonth) return false;
      if (filterSemester !== 'all' && b.semester !== filterSemester) return false;
      return true;
    });
  }, [bills, filterStatus, filterMonth, filterSemester]);

  // ─── Student filter for add-bill modal ───
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (studentSemFilter !== 'all') {
        const sSem = s.semester || s.sem || '';
        if (sSem !== studentSemFilter) return false;
      }
      if (studentRoomTypeFilter !== 'all' && s.room_type !== studentRoomTypeFilter) {
        return false;
      }
      if (studentAcFilter !== 'all') {
        const wantsAc = studentAcFilter === 'ac';
        if (s.ac_available !== wantsAc) return false;
      }
      if (studentBathroomFilter !== 'all') {
        const wantsAttached = studentBathroomFilter === 'attached';
        if (s.attached_bathroom !== wantsAttached) return false;
      }
      if (studentSearch.trim()) {
        const q = studentSearch.toLowerCase();
        const name = (s.name || s.student_name || '').toLowerCase();
        const uid = (s.uid || s.usn || s.student_id || '').toLowerCase();
        if (!name.includes(q) && !uid.includes(q)) return false;
      }
      return true;
    });
  }, [students, studentSemFilter, studentRoomTypeFilter, studentAcFilter, studentBathroomFilter, studentSearch]);

  // ─── Summary calculations ───
  const summary = useMemo(() => {
    if (role === 'student') {
      const totalDue = bills
        .filter((b) => b.status !== 'approved' && b.status !== 'paid')
        .reduce((s, b) => s + (b.amount || 0), 0);
      const totalPaid = bills
        .filter((b) => b.status === 'approved' || b.status === 'paid')
        .reduce((s, b) => s + (b.amount || 0), 0);
      const upcoming = bills
        .filter((b) => b.status !== 'approved' && b.status !== 'paid' && b.due_date)
        .sort((a, b) => a.due_date.localeCompare(b.due_date));
      return { totalDue, totalPaid, nextDueDate: upcoming[0]?.due_date || null };
    } else {
      const totalRevenue = bills.reduce((s, b) => s + (b.amount || 0), 0);
      const collected = bills
        .filter((b) => b.status === 'approved' || b.status === 'paid')
        .reduce((s, b) => s + (b.amount || 0), 0);
      const pending = bills
        .filter((b) => b.status !== 'approved' && b.status !== 'paid')
        .reduce((s, b) => s + (b.amount || 0), 0);
      const overdueCount = bills.filter((b) => b.status === 'overdue').length;
      return { totalRevenue, collected, pending, overdueCount };
    }
  }, [bills, role]);

  // ─── Handlers ───
  const handleMarkPaid = async (bill) => {
    try {
      await updateDocument('hostelBills', bill.id || bill.$id, { status: 'approved' });
      toast.success('Bill marked as paid');
      fetchBills();
    } catch {
      toast.error('Failed to update bill');
    }
  };

  const handleBulkMarkPaid = async () => {
    if (selectedIds.length === 0) {
      toast('Select bills first', { icon: '⚠️' });
      return;
    }
    setSubmitting(true);
    try {
      await Promise.all(
        selectedIds.map((id) => updateDocument('hostelBills', id, { status: 'approved' }))
      );
      toast.success(`${selectedIds.length} bill(s) marked as approved/paid`);
      setSelectedIds([]);
      fetchBills();
    } catch {
      toast.error('Some updates failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveAccountDetails = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const detailsToSave = { ...accountDetails };

      // If a new QR file was selected, upload it to Appwrite Storage
      if (qrFileObj) {
        try {
          const uploadedUrl = await uploadFile(qrFileObj);
          if (uploadedUrl) {
            detailsToSave.qr_image_url = uploadedUrl;
          }
        } catch (uploadErr) {
          console.error('QR upload failed:', uploadErr);
          toast.error('Failed to upload QR image. Saving without custom QR.');
        }
      }

      const existing = await queryDocuments('hostelNotices', [
        Query.equal('title', `account_settings_${hostelType}`),
        Query.equal('hostel_type', hostelType)
      ]);
      const contentStr = JSON.stringify(detailsToSave);
      if (existing && existing.length > 0) {
        await updateDocument('hostelNotices', existing[0].$id || existing[0].id, {
          content: contentStr
        });
      } else {
        await addDocument('hostelNotices', {
          notice_id: `acc_${Date.now()}`,
          title: `account_settings_${hostelType}`,
          content: contentStr,
          is_emergency: false,
          hostel_type: hostelType,
          pdf_url: '',
          createdAt: new Date().toISOString()
        });
      }
      setAccountDetails(detailsToSave);
      toast.success('Account details updated successfully');
      setShowAccountModal(false);
      setQrFilePreview('');
      setQrFileObj(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update account details');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQrFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('QR image must be under 2MB');
        return;
      }
      setQrFileObj(file);
      const reader = new FileReader();
      reader.onload = (ev) => {
        setQrFilePreview(ev.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDownloadQR = () => {
    const qrUrl = getQRImageUrl();
    if (!qrUrl) return toast.error('No QR code available');

    // If it's a data URL, download directly
    if (qrUrl.startsWith('data:')) {
      const link = document.createElement('a');
      link.href = qrUrl;
      link.download = `hostel_payment_qr_${hostelType}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('QR Code downloaded!');
      return;
    }

    // For external URLs, fetch and download
    fetch(qrUrl)
      .then(res => res.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `hostel_payment_qr_${hostelType}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('QR Code downloaded!');
      })
      .catch(() => {
        // Fallback: open in new tab
        window.open(qrUrl, '_blank');
        toast.success('QR opened in new tab');
      });
  };

  const getQRImageUrl = () => {
    // Prefer custom uploaded QR, else fall back to auto-generated
    if (accountDetails.qr_image_url) {
      return accountDetails.qr_image_url;
    }
    if (accountDetails.upi_id) {
      return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi://pay?pa=${accountDetails.upi_id}%26pn=Hostel%20Warden%26cu=INR`;
    }
    return '';
  };

  const handleSubmitProof = async (e) => {
    e.preventDefault();
    if (!transactionId.trim()) return toast.error('Transaction ID is required');
    setSubmitting(true);
    try {
      const billId = selectedBillForProof.id || selectedBillForProof.$id;
      const mockReceiptUrl = receiptFile 
        ? 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600' 
        : 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600';

      await updateDocument('hostelBills', billId, {
        status: 'paid_submitted',
        transaction_id: transactionId.trim(),
        payment_remarks: remarks.trim(),
        receipt_url: mockReceiptUrl
      });
      toast.success('Payment proof submitted successfully! Warden will review.');
      setShowProofModal(false);
      setSelectedBillForProof(null);
      setTransactionId('');
      setRemarks('');
      setReceiptFile(null);
      fetchBills();
    } catch (err) {
      console.error(err);
      toast.error('Failed to submit payment proof');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyAction = async (actionType) => {
    setSubmitting(true);
    try {
      const billId = selectedBillForVerify.id || selectedBillForVerify.$id;
      let newStatus = '';
      let msg = '';
      let updateFields = {};

      if (actionType === 'progress') {
        newStatus = 'in_progress';
        msg = 'Bill review marked in-progress';
        updateFields = { status: newStatus };
      } else if (actionType === 'approve') {
        newStatus = 'approved';
        msg = 'Payment approved successfully!';
        updateFields = { status: newStatus };
      } else if (actionType === 'reject') {
        newStatus = 'unpaid';
        msg = 'Payment proof rejected.';
        updateFields = { 
          status: newStatus,
          payment_remarks: rejectReason ? `Rejected: ${rejectReason}` : 'Payment proof rejected by warden.',
          transaction_id: '',
          receipt_url: ''
        };
      }

      await updateDocument('hostelBills', billId, updateFields);
      toast.success(msg);
      setShowVerifyModal(false);
      setSelectedBillForVerify(null);
      setRejectReason('');
      fetchBills();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update verification status');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenAddBill = () => {
    setShowAddModal(true);
    setBillAmount('');
    setBillMonth('');
    setBillDueDate('');
    setBillDescription('');
    setSelectedStudentIds([]);
    setStudentSemFilter('all');
    setStudentRoomTypeFilter('all');
    setStudentAcFilter('all');
    setStudentBathroomFilter('all');
    setStudentSearch('');
    fetchStudents();
  };

  const handleAddBillBulk = async (e) => {
    e.preventDefault();
    if (selectedStudentIds.length === 0) {
      toast.error('Select at least one student');
      return;
    }
    if (!billAmount || !billMonth || !billDueDate) {
      toast.error('Amount, billing month, and due date are required');
      return;
    }
    setSubmitting(true);
    try {
      const promises = selectedStudentIds.map((sid) => {
        const student = students.find(s => (s.uid || s.usn || s.student_id || s.$id) === sid);
        const studentName = student ? (student.name || student.student_name || sid) : sid;
        return addDocument('hostelBills', {
          student_id: sid,
          student_name: studentName,
          amount: parseInt(billAmount, 10),
          billing_month: billMonth.trim(),
          due_date: billDueDate,
          description: billDescription.trim(),
          semester: studentSemFilter !== 'all' ? studentSemFilter : (student?.semester || student?.sem || ''),
          status: 'unpaid',
          hostel_type: hostelType,
          createdAt: new Date().toISOString(),
        });
      });
      await Promise.all(promises);
      toast.success(`Bill sent to ${selectedStudentIds.length} student(s) successfully!`);
      setShowAddModal(false);
      setSelectedStudentIds([]);
      fetchBills();
    } catch {
      toast.error('Failed to add some bills');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStudentSelect = (id) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAllStudents = () => {
    const visible = filteredStudents.map((s) => s.uid || s.usn || s.student_id || s.$id);
    if (visible.every(id => selectedStudentIds.includes(id)) && visible.length > 0) {
      setSelectedStudentIds(prev => prev.filter(id => !visible.includes(id)));
    } else {
      setSelectedStudentIds(prev => [...new Set([...prev, ...visible])]);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const unpaid = filteredBills.filter((b) => b.status !== 'approved' && b.status !== 'paid');
    if (selectedIds.length === unpaid.length && unpaid.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(unpaid.map((b) => b.id || b.$id));
    }
  };

  // ─── Helpers ───
  const formatCurrency = (n) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const statusConfig = {
    unpaid: { color: 'var(--warning)', bg: 'var(--warning-light)', icon: <MdWarning />, label: 'Unpaid' },
    paid_submitted: { color: '#f59e0b', bg: '#fef3c7', icon: <MdPayment />, label: 'Paid (Review Needed)' },
    in_progress: { color: '#3b82f6', bg: '#dbeafe', icon: <MdPendingActions />, label: 'Review In Progress' },
    approved: { color: 'var(--success)', bg: 'var(--success-light)', icon: <MdCheckCircle />, label: 'Approved' },
    overdue: { color: 'var(--danger)', bg: 'var(--danger-light)', icon: <MdError />, label: 'Overdue' },
    paid: { color: 'var(--success)', bg: 'var(--success-light)', icon: <MdCheckCircle />, label: 'Approved' },
  };

  // ─── Styles ───
  const pageStyle = {
    padding: '24px 16px',
    maxWidth: 1100,
    margin: '0 auto',
    minHeight: '100vh',
  };

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 28,
  };

  const statCardStyle = (gradient) => ({
    flex: '1 1 200px',
    minWidth: 180,
    padding: '20px 18px',
    borderRadius: 16,
    background: gradient,
    color: '#fff',
    position: 'relative',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-md)',
    transition: 'transform 0.25s ease',
  });

  const statIconStyle = {
    position: 'absolute',
    top: 12,
    right: 14,
    fontSize: '2.4rem',
    opacity: 0.25,
  };

  const billCardStyle = {
    background: 'var(--surface-1)',
    borderRadius: 14,
    padding: '18px 20px',
    boxShadow: 'var(--shadow-md)',
    border: '1px solid var(--border)',
    transition: 'all 0.25s ease',
    position: 'relative',
  };

  const filterBarStyle = {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 20,
    padding: '12px 16px',
    borderRadius: 12,
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
  };

  const selectStyle = {
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--surface-1)',
    color: 'var(--text)',
    fontSize: '0.85rem',
    outline: 'none',
    cursor: 'pointer',
  };

  const modalOverlayStyle = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 16,
    animation: 'fadeIn 0.2s ease',
  };

  const modalStyle = {
    background: 'var(--surface-1)',
    borderRadius: 18,
    padding: '28px 24px',
    maxWidth: 460,
    width: '100%',
    boxShadow: 'var(--shadow-lg)',
    border: '1px solid var(--border)',
    position: 'relative',
    animation: 'slideUp 0.3s ease',
  };

  // ─── Loading ───
  if (loading) {
    return (
      <div className="loader-container">
        <div className="loader" />
      </div>
    );
  }

  const qrImageUrl = getQRImageUrl();

  return (
    <div style={pageStyle}>
      {/* Keyframe animations */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes cardIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* ─── Header ─── */}
      <div style={headerStyle}>
        <div>
          <h1 className="page-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <MdReceipt style={{ color: accent }} />
            {role === 'student' ? 'My Bills' : 'Bill Management'}
          </h1>
          <p className="page-subtitle" style={{ margin: '4px 0 0 0' }}>
            {role === 'student'
              ? 'View and manage your hostel billing'
              : `Manage bills for ${hostelType} hostel`}
          </p>
        </div>
        {role === 'warden' && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {selectedIds.length > 0 && (
              <button
                className="btn btn-primary btn-sm"
                onClick={handleBulkMarkPaid}
                disabled={submitting}
                style={{
                  background: 'var(--success)',
                  borderColor: 'var(--success)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <MdDoneAll /> Mark {selectedIds.length} Paid
              </button>
            )}
            <button
              className="btn btn-primary btn-sm"
              onClick={handleOpenAddBill}
              style={{
                background: accent,
                borderColor: accent,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <MdAdd /> Add Bill
            </button>
          </div>
        )}
      </div>

      {/* ─── Account/Payment details Section ─── */}
      <div style={{
        background: 'var(--surface-1)',
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '24px',
        boxShadow: 'var(--shadow-md)',
        border: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: '20px',
        alignItems: 'center',
        justifyContent: 'space-between',
        animation: 'slideUp 0.3s ease'
      }}>
        <div style={{ flex: '1 1 300px' }}>
          <h3 style={{ margin: 0, fontSize: '0.94rem', fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <MdPayment style={{ color: accent }} /> Warden Bank Account & Payment Details
          </h3>
          <p style={{ margin: '4px 0 16px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Use these details to pay your hostel/mess fees. Submit proof of transaction below.
          </p>
          {loadingAccount ? (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading payment details...</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', fontSize: '0.82rem' }}>
              <div>
                <strong style={{ color: 'var(--text-muted)' }}>Bank Name:</strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text)', fontWeight: 600, marginTop: 2 }}>
                  <span>{accountDetails.bank_name || '—'}</span>
                  {accountDetails.bank_name && (
                    <button
                      onClick={() => { navigator.clipboard.writeText(accountDetails.bank_name); toast.success('Bank name copied!'); }}
                      title="Copy Bank Name"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 4px', display: 'flex', alignItems: 'center', borderRadius: 4, transition: 'color 0.2s' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = accent}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      <MdContentCopy style={{ fontSize: '0.85rem' }} />
                    </button>
                  )}
                </div>
              </div>
              <div>
                <strong style={{ color: 'var(--text-muted)' }}>Account Number:</strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text)', fontWeight: 600, marginTop: 2 }}>
                  <span>{accountDetails.account_number || '—'}</span>
                  {accountDetails.account_number && (
                    <button
                      onClick={() => { navigator.clipboard.writeText(accountDetails.account_number); toast.success('Account number copied!'); }}
                      title="Copy Account Number"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 4px', display: 'flex', alignItems: 'center', borderRadius: 4, transition: 'color 0.2s' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = accent}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      <MdContentCopy style={{ fontSize: '0.85rem' }} />
                    </button>
                  )}
                </div>
              </div>
              <div>
                <strong style={{ color: 'var(--text-muted)' }}>IFSC Code:</strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text)', fontWeight: 600, marginTop: 2 }}>
                  <span>{accountDetails.ifsc_code || '—'}</span>
                  {accountDetails.ifsc_code && (
                    <button
                      onClick={() => { navigator.clipboard.writeText(accountDetails.ifsc_code); toast.success('IFSC code copied!'); }}
                      title="Copy IFSC Code"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 4px', display: 'flex', alignItems: 'center', borderRadius: 4, transition: 'color 0.2s' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = accent}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      <MdContentCopy style={{ fontSize: '0.85rem' }} />
                    </button>
                  )}
                </div>
              </div>
              <div>
                <strong style={{ color: 'var(--text-muted)' }}>UPI ID:</strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text)', fontWeight: 600, marginTop: 2 }}>
                  <span>{accountDetails.upi_id || '—'}</span>
                  {accountDetails.upi_id && (
                    <button
                      onClick={() => { navigator.clipboard.writeText(accountDetails.upi_id); toast.success('UPI ID copied!'); }}
                      title="Copy UPI ID"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 4px', display: 'flex', alignItems: 'center', borderRadius: 4, transition: 'color 0.2s' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = accent}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      <MdContentCopy style={{ fontSize: '0.85rem' }} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* QR Code / Action Column */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          {!loadingAccount && qrImageUrl && (
            <div style={{
              background: 'white',
              padding: '8px',
              borderRadius: '14px',
              border: '2px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-md)',
              position: 'relative'
            }}>
              <img 
                src={qrImageUrl}
                alt="Payment QR" 
                style={{ width: 120, height: 120, display: 'block', borderRadius: 8, objectFit: 'contain' }}
                title="Scan to Pay via UPI"
                crossOrigin="anonymous"
              />
              {accountDetails.qr_image_url && (
                <div style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  background: accent,
                  borderRadius: '50%',
                  width: 20,
                  height: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <MdQrCode style={{ color: '#fff', fontSize: '0.7rem' }} />
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {/* Download QR Button */}
            {!loadingAccount && qrImageUrl && (
              <button
                onClick={handleDownloadQR}
                className="btn btn-outline btn-sm"
                style={{
                  borderColor: '#10b981',
                  color: '#10b981',
                  borderRadius: 20,
                  padding: '5px 14px',
                  fontSize: '0.76rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#10b981';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#10b981';
                }}
              >
                <MdDownload /> Download QR
              </button>
            )}
            
            {role === 'warden' && (
              <button
                onClick={() => setShowAccountModal(true)}
                className="btn btn-outline btn-sm"
                style={{ borderColor: accent, color: accent, borderRadius: 20, padding: '5px 14px', fontSize: '0.76rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                ⚙️ Configure
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Summary Stats ─── */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 26 }}>
        {role === 'student' ? (
          <>
            <div
              style={statCardStyle(`linear-gradient(135deg, ${accent}, ${accentDark})`)}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-4px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <div style={statIconStyle}><MdPendingActions /></div>
              <p style={{ margin: 0, fontSize: '0.78rem', opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Due</p>
              <p style={{ margin: '6px 0 0', fontSize: '1.6rem', fontWeight: 800 }}>{formatCurrency(summary.totalDue)}</p>
            </div>
            <div
              style={statCardStyle('linear-gradient(135deg, #10b981, #047857)')}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-4px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <div style={statIconStyle}><MdCheckCircle /></div>
              <p style={{ margin: 0, fontSize: '0.78rem', opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Paid</p>
              <p style={{ margin: '6px 0 0', fontSize: '1.6rem', fontWeight: 800 }}>{formatCurrency(summary.totalPaid)}</p>
            </div>
            <div
              style={statCardStyle('linear-gradient(135deg, #f59e0b, #d97706)')}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-4px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <div style={statIconStyle}><MdCalendarToday /></div>
              <p style={{ margin: 0, fontSize: '0.78rem', opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.5 }}>Next Due Date</p>
              <p style={{ margin: '6px 0 0', fontSize: '1.3rem', fontWeight: 700 }}>
                {summary.nextDueDate ? formatDate(summary.nextDueDate) : 'None'}
              </p>
            </div>
          </>
        ) : (
          <>
            <div
              style={statCardStyle(`linear-gradient(135deg, ${accent}, ${accentDark})`)}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-4px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <div style={statIconStyle}><MdTrendingUp /></div>
              <p style={{ margin: 0, fontSize: '0.78rem', opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Revenue</p>
              <p style={{ margin: '6px 0 0', fontSize: '1.6rem', fontWeight: 800 }}>{formatCurrency(summary.totalRevenue)}</p>
            </div>
            <div
              style={statCardStyle('linear-gradient(135deg, #10b981, #047857)')}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-4px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <div style={statIconStyle}><MdDoneAll /></div>
              <p style={{ margin: 0, fontSize: '0.78rem', opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.5 }}>Collected</p>
              <p style={{ margin: '6px 0 0', fontSize: '1.6rem', fontWeight: 800 }}>{formatCurrency(summary.collected)}</p>
            </div>
            <div
              style={statCardStyle('linear-gradient(135deg, #f59e0b, #d97706)')}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-4px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <div style={statIconStyle}><MdPendingActions /></div>
              <p style={{ margin: 0, fontSize: '0.78rem', opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.5 }}>Pending</p>
              <p style={{ margin: '6px 0 0', fontSize: '1.6rem', fontWeight: 800 }}>{formatCurrency(summary.pending)}</p>
            </div>
            <div
              style={statCardStyle('linear-gradient(135deg, #ef4444, #b91c1c)')}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-4px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <div style={statIconStyle}><MdError /></div>
              <p style={{ margin: 0, fontSize: '0.78rem', opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.5 }}>Overdue</p>
              <p style={{ margin: '6px 0 0', fontSize: '1.6rem', fontWeight: 800 }}>{summary.overdueCount}</p>
            </div>
          </>
        )}
      </div>

      {/* ─── Filters ─── */}
      <div style={filterBarStyle}>
        <MdFilterList style={{ color: accent, fontSize: '1.2rem' }} />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={selectStyle}
        >
          <option value="all">All Statuses</option>
          <option value="unpaid">Unpaid</option>
          <option value="paid_submitted">Paid (Review)</option>
          <option value="in_progress">In Progress</option>
          <option value="approved">Approved</option>
          <option value="overdue">Overdue</option>
        </select>
        <select
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          style={selectStyle}
        >
          <option value="all">All Months</option>
          {uniqueMonths.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select
          value={filterSemester}
          onChange={(e) => setFilterSemester(e.target.value)}
          style={selectStyle}
        >
          <option value="all">All Semesters</option>
          {SEMESTERS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
          {uniqueSemesters.filter(s => !SEMESTERS.includes(s)).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {role === 'warden' && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={toggleSelectAll}
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.82rem' }}
          >
            <MdSelectAll /> {selectedIds.length > 0 ? 'Deselect All' : 'Select All Unpaid'}
          </button>
        )}
      </div>

      {/* ─── Bills List ─── */}
      {filteredBills.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 40 }}>
          <div className="empty-icon">
            <MdReceipt />
          </div>
          <h3>No Bills Found</h3>
          <p className="text-muted">
            {role === 'student'
              ? 'You have no bills at the moment.'
              : 'No bills match the current filters.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {filteredBills.map((bill, idx) => {
            const sc = statusConfig[bill.status] || statusConfig.unpaid;
            const billId = bill.id || bill.$id;
            const isSelected = selectedIds.includes(billId);

            return (
              <div
                key={billId}
                style={{
                  ...billCardStyle,
                  borderLeft: `4px solid ${sc.color}`,
                  animation: `cardIn 0.3s ease ${idx * 0.04}s both`,
                  ...(isSelected ? { outline: `2px solid ${accent}`, outlineOffset: -1 } : {}),
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                }}
              >
                {/* Warden checkbox */}
                {role === 'warden' && bill.status !== 'approved' && bill.status !== 'paid' && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(billId)}
                    style={{
                      position: 'absolute',
                      top: 14,
                      right: 14,
                      width: 18,
                      height: 18,
                      accentColor: accent,
                      cursor: 'pointer',
                    }}
                  />
                )}

                {/* Status badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 10px',
                      borderRadius: 20,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: sc.bg,
                      color: sc.color,
                    }}
                  >
                    {sc.icon} {sc.label}
                  </span>
                  {bill.semester && (
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: 12,
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      background: accentLight,
                      color: accentDark,
                    }}>
                      {bill.semester}
                    </span>
                  )}
                  <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {bill.billing_month}
                  </span>
                </div>

                {/* Amount */}
                <p style={{ margin: '0 0 10px', fontSize: '1.65rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px' }}>
                  {formatCurrency(bill.amount || 0)}
                </p>

                {/* Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                  {role === 'warden' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text)' }}>Student:</span>
                      <span>{bill.student_name || bill.student_id}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MdCalendarToday style={{ fontSize: '0.9rem' }} />
                    <span>Due: {formatDate(bill.due_date)}</span>
                  </div>
                  {bill.description && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text)' }}>Note:</span>
                      <span>{bill.description}</span>
                    </div>
                  )}
                  {bill.transaction_id && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text)' }}>Txn:</span>
                      <span style={{ fontSize: '0.78rem', fontFamily: 'monospace' }}>{bill.transaction_id}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ marginTop: 14 }}>
                  {role === 'student' ? (
                    (bill.status === 'unpaid' || bill.status === 'overdue') ? (
                      <button
                        className="btn btn-sm"
                        onClick={() => {
                          setSelectedBillForProof(bill);
                          setShowProofModal(true);
                        }}
                        style={{
                          width: '100%',
                          background: accent,
                          border: 'none',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          fontWeight: 600,
                          borderRadius: 10,
                          padding: '8px 0',
                          cursor: 'pointer',
                        }}
                      >
                        <MdPayment /> Pay / Submit Proof
                      </button>
                    ) : (bill.status === 'paid_submitted' || bill.status === 'in_progress') ? (
                      <div style={{
                        textAlign: 'center',
                        fontSize: '0.78rem',
                        background: 'rgba(245, 158, 11, 0.1)',
                        color: '#d97706',
                        border: '1px solid rgba(245, 158, 11, 0.2)',
                        borderRadius: 10,
                        padding: '8px 0',
                        fontWeight: 600
                      }}>
                        ⏳ Proof Under Warden Review
                      </div>
                    ) : (
                      <div style={{
                        textAlign: 'center',
                        fontSize: '0.78rem',
                        background: 'rgba(16, 185, 129, 0.1)',
                        color: 'var(--success)',
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                        borderRadius: 10,
                        padding: '8px 0',
                        fontWeight: 600
                      }}>
                        ✅ Paid & Approved
                      </div>
                    )
                  ) : (
                    /* Warden actions */
                    (bill.status === 'paid_submitted' || bill.status === 'in_progress') ? (
                      <button
                        className="btn btn-sm"
                        onClick={() => {
                          setSelectedBillForVerify(bill);
                          setShowVerifyModal(true);
                        }}
                        style={{
                          width: '100%',
                          background: '#3b82f6',
                          border: 'none',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          fontWeight: 600,
                          borderRadius: 10,
                          padding: '8px 0',
                          cursor: 'pointer',
                        }}
                      >
                        <MdCheckCircle /> Verify Payment Proof
                      </button>
                    ) : (bill.status === 'unpaid' || bill.status === 'overdue') ? (
                      <button
                        className="btn btn-sm"
                        onClick={() => handleMarkPaid(bill)}
                        style={{
                          width: '100%',
                          background: 'var(--success)',
                          border: 'none',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          fontWeight: 600,
                          borderRadius: 10,
                          padding: '8px 0',
                          cursor: 'pointer',
                        }}
                      >
                        <MdCheckCircle /> Mark as Approved
                      </button>
                    ) : (
                      <div style={{
                        textAlign: 'center',
                        fontSize: '0.78rem',
                        background: 'rgba(16, 185, 129, 0.1)',
                        color: 'var(--success)',
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                        borderRadius: 10,
                        padding: '8px 0',
                        fontWeight: 600
                      }}>
                        ✅ Payment Verified
                      </div>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Add Bill Modal (Warden Only) — Enhanced with student multi-select ─── */}
      {showAddModal && role === 'warden' && (
        <div style={modalOverlayStyle} onClick={() => setShowAddModal(false)}>
          <div style={{ ...modalStyle, maxWidth: 600, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            {/* Close button */}
            <button
              onClick={() => setShowAddModal(false)}
              style={{
                position: 'absolute',
                top: 14,
                right: 14,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                fontSize: '1.3rem',
                padding: 4,
                borderRadius: 8,
                display: 'flex',
                transition: 'color 0.2s',
                zIndex: 2,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              <MdClose />
            </button>

            {/* Modal header */}
            <div style={{ marginBottom: 18, flexShrink: 0 }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <MdAdd style={{ color: accent }} /> Add New Bill
              </h2>
              <p className="text-muted" style={{ margin: '4px 0 0', fontSize: '0.82rem' }}>
                Select students and create bills for {hostelType} hostel
              </p>
            </div>

            <form onSubmit={handleAddBillBulk} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              {/* Bill Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14, flexShrink: 0 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Amount (₹) *</label>
                  <input
                    className="form-control"
                    type="number"
                    placeholder="e.g. 5000"
                    min="1"
                    value={billAmount}
                    onChange={(e) => setBillAmount(e.target.value)}
                    required
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Billing Month *</label>
                  <input
                    className="form-control"
                    type="text"
                    placeholder="e.g. June 2026"
                    value={billMonth}
                    onChange={(e) => setBillMonth(e.target.value)}
                    required
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14, flexShrink: 0 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Due Date *</label>
                  <input
                    className="form-control"
                    type="date"
                    value={billDueDate}
                    onChange={(e) => setBillDueDate(e.target.value)}
                    required
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Description</label>
                  <input
                    className="form-control"
                    type="text"
                    placeholder="e.g. Hostel Rent"
                    value={billDescription}
                    onChange={(e) => setBillDescription(e.target.value)}
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              {/* Student Selection */}
              <div style={{
                borderTop: '1px solid var(--border)',
                paddingTop: 14,
                marginBottom: 10,
                flexShrink: 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MdPeople style={{ color: accent }} /> Select Students
                    {selectedStudentIds.length > 0 && (
                      <span style={{
                        background: accent,
                        color: '#fff',
                        borderRadius: 20,
                        padding: '2px 10px',
                        fontSize: '0.72rem',
                        fontWeight: 700
                      }}>
                        {selectedStudentIds.length} selected
                      </span>
                    )}
                  </h4>
                  <button
                    type="button"
                    onClick={toggleSelectAllStudents}
                    style={{
                      background: 'none',
                      border: `1px solid ${accent}`,
                      color: accent,
                      borderRadius: 16,
                      padding: '3px 12px',
                      fontSize: '0.72rem',
                      cursor: 'pointer',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <MdSelectAll /> {filteredStudents.every(s => selectedStudentIds.includes(s.uid || s.usn || s.student_id || s.$id)) && filteredStudents.length > 0 ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                {/* Filters */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                  <select
                    value={studentSemFilter}
                    onChange={(e) => setStudentSemFilter(e.target.value)}
                    style={{ ...selectStyle, fontSize: '0.78rem', padding: '6px 10px' }}
                  >
                    <option value="all">All Semesters</option>
                    {SEMESTERS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <select
                    value={studentRoomTypeFilter}
                    onChange={(e) => setStudentRoomTypeFilter(e.target.value)}
                    style={{ ...selectStyle, fontSize: '0.78rem', padding: '6px 10px' }}
                  >
                    <option value="all">All Room Types</option>
                    <option value="single">Single Sharing</option>
                    <option value="double">Double Sharing</option>
                    <option value="triple">Triple Sharing</option>
                    <option value="suite">Four Sharing Suite</option>
                  </select>
                  <select
                    value={studentAcFilter}
                    onChange={(e) => setStudentAcFilter(e.target.value)}
                    style={{ ...selectStyle, fontSize: '0.78rem', padding: '6px 10px' }}
                  >
                    <option value="all">All (AC/Non-AC)</option>
                    <option value="ac">AC Rooms</option>
                    <option value="non-ac">Non-AC Rooms</option>
                  </select>
                  <select
                    value={studentBathroomFilter}
                    onChange={(e) => setStudentBathroomFilter(e.target.value)}
                    style={{ ...selectStyle, fontSize: '0.78rem', padding: '6px 10px' }}
                  >
                    <option value="all">All Bathrooms</option>
                    <option value="attached">Attached Bath</option>
                    <option value="shared">Shared Bath</option>
                  </select>
                  <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
                    <MdSearch style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1rem' }} />
                    <input
                      type="text"
                      placeholder="Search by name or USN..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      style={{
                        ...selectStyle,
                        width: '100%',
                        paddingLeft: 30,
                        fontSize: '0.78rem',
                        padding: '6px 10px 6px 30px',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Student List */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                border: '1px solid var(--border)',
                borderRadius: 10,
                background: 'var(--surface-2)',
                marginBottom: 14,
                maxHeight: 220,
                minHeight: 120,
              }}>
                {loadingStudents ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 30 }}>
                    <div className="loader" style={{ width: 24, height: 24 }} />
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    {students.length === 0 ? 'No students registered in this hostel block.' : 'No students match the selected filters.'}
                  </div>
                ) : (
                  filteredStudents.map((student, i) => {
                    const sid = student.uid || student.usn || student.student_id || student.$id;
                    const isChecked = selectedStudentIds.includes(sid);
                    const studentName = student.name || student.student_name || 'Unknown';
                    const studentUsn = student.usn || student.uid || student.student_id || '';
                    const studentSem = student.semester || student.sem || '—';
                    const roomNo = student.room_number || '—';

                    return (
                      <div
                        key={sid}
                        onClick={() => toggleStudentSelect(sid)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '10px 14px',
                          cursor: 'pointer',
                          borderBottom: i < filteredStudents.length - 1 ? '1px solid var(--border)' : 'none',
                          background: isChecked ? `${accentLight}` : 'transparent',
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={(e) => { if (!isChecked) e.currentTarget.style.background = 'var(--surface-3, rgba(0,0,0,0.03))'; }}
                        onMouseLeave={(e) => { if (!isChecked) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          style={{ width: 16, height: 16, accentColor: accent, cursor: 'pointer', flexShrink: 0 }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {studentName}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span>{studentUsn}</span>
                            <span>•</span>
                            <span>Room {roomNo}</span>
                            {student.room_type && (
                              <>
                                <span>•</span>
                                <span style={{ textTransform: 'capitalize' }}>
                                  {student.room_type} sharing
                                  {student.ac_available ? ' (AC)' : ' (Non-AC)'}
                                  {student.attached_bathroom ? ' • Attached Bath' : ''}
                                </span>
                              </>
                            )}
                            <span>•</span>
                            <span>{studentSem}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Hostel type indicator */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 12,
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: accentLight,
                  fontSize: '0.82rem',
                  color: accentDark,
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                <MdReceipt />
                {hostelType.charAt(0).toUpperCase() + hostelType.slice(1)} Hostel • {selectedStudentIds.length} student(s) selected
              </div>

              <button
                className="btn btn-primary btn-block"
                type="submit"
                disabled={submitting || selectedStudentIds.length === 0}
                style={{
                  background: selectedStudentIds.length > 0 ? accent : 'var(--text-muted)',
                  borderColor: selectedStudentIds.length > 0 ? accent : 'var(--text-muted)',
                  fontWeight: 600,
                  borderRadius: 10,
                  padding: '10px 0',
                  flexShrink: 0,
                  opacity: selectedStudentIds.length === 0 ? 0.6 : 1
                }}
              >
                {submitting ? 'Sending Bills…' : `Send Bill to ${selectedStudentIds.length} Student(s)`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── Configure Account Modal (Warden Only) — With QR Upload ─── */}
      {showAccountModal && role === 'warden' && (
        <div style={modalOverlayStyle} onClick={() => { setShowAccountModal(false); setQrFilePreview(''); }}>
          <div style={{ ...modalStyle, maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => { setShowAccountModal(false); setQrFilePreview(''); }}
              style={{
                position: 'absolute',
                top: 14,
                right: 14,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                fontSize: '1.3rem',
                padding: 4,
                display: 'flex'
              }}
            >
              <MdClose />
            </button>

            <div style={{ marginBottom: 22 }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <MdPayment style={{ color: accent }} /> Configure Bank & QR Details
              </h2>
              <p className="text-muted" style={{ margin: '4px 0 0', fontSize: '0.82rem' }}>
                Set bank account, UPI, and payment QR code for fee collections
              </p>
            </div>

            <form onSubmit={handleSaveAccountDetails} style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Bank Name</label>
                <input
                  className="form-control"
                  type="text"
                  placeholder="e.g. State Bank of India"
                  value={accountDetails.bank_name}
                  onChange={(e) => setAccountDetails({ ...accountDetails, bank_name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Account Number</label>
                <input
                  className="form-control"
                  type="text"
                  placeholder="e.g. 12345678901"
                  value={accountDetails.account_number}
                  onChange={(e) => setAccountDetails({ ...accountDetails, account_number: e.target.value })}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">IFSC Code</label>
                <input
                  className="form-control"
                  type="text"
                  placeholder="e.g. SBIN0001234"
                  value={accountDetails.ifsc_code}
                  onChange={(e) => setAccountDetails({ ...accountDetails, ifsc_code: e.target.value })}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">UPI ID</label>
                <input
                  className="form-control"
                  type="text"
                  placeholder="e.g. warden@upi"
                  value={accountDetails.upi_id}
                  onChange={(e) => setAccountDetails({ ...accountDetails, upi_id: e.target.value })}
                  required
                />
              </div>

              {/* QR Code Upload Section */}
              <div style={{
                borderTop: '1px solid var(--border)',
                paddingTop: 16,
                marginTop: 4,
                marginBottom: 16,
              }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MdQrCode style={{ color: accent }} /> Custom Payment QR Code
                </label>
                <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '2px 0 10px' }}>
                  Upload your GPay/UPI QR code image. If not uploaded, a QR will be auto-generated from your UPI ID.
                </p>

                {/* Current/Preview QR */}
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap' }}>
                  {(qrFilePreview || accountDetails.qr_image_url) && (
                    <div style={{
                      background: 'white',
                      padding: 6,
                      borderRadius: 10,
                      border: '1px solid var(--border)',
                      boxShadow: 'var(--shadow-sm)'
                    }}>
                      <img
                        src={qrFilePreview || accountDetails.qr_image_url}
                        alt="QR Preview"
                        style={{ width: 100, height: 100, objectFit: 'contain', borderRadius: 6 }}
                      />
                      <div style={{ textAlign: 'center', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 4 }}>
                        {qrFilePreview ? 'New QR' : 'Current QR'}
                      </div>
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <label
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: '18px 14px',
                        border: `2px dashed ${accent}40`,
                        borderRadius: 12,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        background: `${accent}08`,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.background = `${accent}15`; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${accent}40`; e.currentTarget.style.background = `${accent}08`; }}
                    >
                      <MdUpload style={{ fontSize: '1.5rem', color: accent }} />
                      <span style={{ fontSize: '0.78rem', color: accent, fontWeight: 600 }}>
                        Upload QR Image
                      </span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        PNG, JPG — Max 2MB
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleQrFileChange}
                        style={{ display: 'none' }}
                      />
                    </label>

                    {/* Clear custom QR */}
                    {(qrFilePreview || accountDetails.qr_image_url) && (
                      <button
                        type="button"
                        onClick={() => {
                          setQrFilePreview('');
                          setAccountDetails({ ...accountDetails, qr_image_url: '' });
                        }}
                        style={{
                          marginTop: 8,
                          width: '100%',
                          background: 'none',
                          border: '1px solid var(--danger, #ef4444)',
                          color: 'var(--danger, #ef4444)',
                          borderRadius: 8,
                          padding: '5px 12px',
                          fontSize: '0.72rem',
                          cursor: 'pointer',
                          fontWeight: 600
                        }}
                      >
                        Remove Custom QR (use auto-generated)
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <button
                className="btn btn-primary btn-block"
                type="submit"
                disabled={submitting}
                style={{ background: accent, borderColor: accent, fontWeight: 600, borderRadius: 10, padding: '10px 0' }}
              >
                {submitting ? 'Saving…' : 'Save Details'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── Submit Payment Proof Modal (Student Only) ─── */}
      {showProofModal && role === 'student' && selectedBillForProof && (
        <div style={modalOverlayStyle} onClick={() => { setShowProofModal(false); setSelectedBillForProof(null); }}>
          <div style={{ ...modalStyle, maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => { setShowProofModal(false); setSelectedBillForProof(null); }}
              style={{
                position: 'absolute',
                top: 14,
                right: 14,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                fontSize: '1.3rem',
                padding: 4,
                display: 'flex'
              }}
            >
              <MdClose />
            </button>

            <div style={{ marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <MdReceipt style={{ color: accent }} /> Submit Payment Proof
              </h2>
              <p className="text-muted" style={{ margin: '4px 0 0', fontSize: '0.82rem' }}>
                Bill for {selectedBillForProof.billing_month} — Amount: {formatCurrency(selectedBillForProof.amount)}
              </p>
            </div>

            <form onSubmit={handleSubmitProof}>
              <div style={{
                background: 'var(--surface-2)',
                borderRadius: 12,
                padding: '12px 14px',
                border: '1px solid var(--border)',
                marginBottom: 16,
                fontSize: '0.82rem',
                display: 'flex',
                flexDirection: 'column',
                gap: 6
              }}>
                <div style={{ fontWeight: 700, color: 'var(--text)', borderBottom: '1px solid var(--border)', paddingBottom: 6, marginBottom: 4 }}>
                  Transfer fees to:
                </div>
                <div><strong>Bank Name:</strong> {accountDetails.bank_name}</div>
                <div><strong>Account:</strong> {accountDetails.account_number}</div>
                <div><strong>IFSC Code:</strong> {accountDetails.ifsc_code}</div>
                <div><strong>UPI ID:</strong> {accountDetails.upi_id}</div>
                {qrImageUrl && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '8px 0', gap: 6 }}>
                    <img 
                      src={qrImageUrl}
                      alt="UPI QR" 
                      style={{ width: 120, height: 120, border: '1px solid var(--border)', padding: 4, background: 'white', borderRadius: 8, objectFit: 'contain' }}
                    />
                    <button
                      type="button"
                      onClick={handleDownloadQR}
                      style={{
                        background: 'none',
                        border: `1px solid ${accent}`,
                        color: accent,
                        borderRadius: 16,
                        padding: '4px 12px',
                        fontSize: '0.7rem',
                        cursor: 'pointer',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <MdDownload /> Download QR
                    </button>
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Transaction ID / UPI Reference</label>
                <input
                  className="form-control"
                  type="text"
                  placeholder="e.g. UPI382049102930"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Payment Description / Remarks</label>
                <textarea
                  className="form-control"
                  placeholder="e.g. Paid from GPay"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  style={{ minHeight: 60, resize: 'vertical' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label">Upload Receipt Screenshot</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setReceiptFile(e.target.files[0])}
                  className="form-control"
                  style={{ padding: '8px' }}
                />
                {receiptFile && (
                  <div style={{ fontSize: '0.72rem', color: accent, marginTop: 4, fontWeight: 600 }}>
                    📎 {receiptFile.name} selected
                  </div>
                )}
              </div>

              <button
                className="btn btn-primary btn-block"
                type="submit"
                disabled={submitting}
                style={{ background: accent, borderColor: accent, fontWeight: 600, borderRadius: 10, padding: '10px 0' }}
              >
                {submitting ? 'Submitting…' : 'Submit Proof'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── Verify Payment Proof Modal (Warden Only) ─── */}
      {showVerifyModal && role === 'warden' && selectedBillForVerify && (
        <div style={modalOverlayStyle} onClick={() => { setShowVerifyModal(false); setSelectedBillForVerify(null); }}>
          <div style={{ ...modalStyle, maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => { setShowVerifyModal(false); setSelectedBillForVerify(null); }}
              style={{
                position: 'absolute',
                top: 14,
                right: 14,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                fontSize: '1.3rem',
                padding: 4,
                display: 'flex'
              }}
            >
              <MdClose />
            </button>

            <div style={{ marginBottom: 18 }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <MdCheckCircle style={{ color: '#3b82f6' }} /> Verify Resident Payment
              </h2>
              <p className="text-muted" style={{ margin: '4px 0 0', fontSize: '0.82rem' }}>
                Review transaction receipt submitted by {selectedBillForVerify.student_name || selectedBillForVerify.student_id}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: '0.82rem', background: 'var(--surface-2)', padding: 12, borderRadius: 10 }}>
                <div><strong>Month:</strong> {selectedBillForVerify.billing_month}</div>
                <div><strong>Amount:</strong> {formatCurrency(selectedBillForVerify.amount)}</div>
                <div style={{ gridColumn: 'span 2' }}>
                  <strong>Transaction ID:</strong> <span style={{ fontFamily: 'monospace', color: accent }}>{selectedBillForVerify.transaction_id}</span>
                </div>
                {selectedBillForVerify.payment_remarks && (
                  <div style={{ gridColumn: 'span 2' }}>
                    <strong>Student Note:</strong> {selectedBillForVerify.payment_remarks}
                  </div>
                )}
              </div>

              {selectedBillForVerify.receipt_url && (
                <div>
                  <strong style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Receipt Screenshot:</strong>
                  <a href={selectedBillForVerify.receipt_url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                    <img 
                      src={selectedBillForVerify.receipt_url} 
                      alt="Payment Receipt" 
                      style={{ width: '100%', maxHeight: 180, objectFit: 'contain', background: 'var(--surface-2)', display: 'block' }}
                      title="Click to view full size"
                    />
                  </a>
                </div>
              )}

              {/* Reject Note form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)' }}>Rejection Reason (only if rejecting)</label>
                <input
                  type="text"
                  placeholder="e.g. Incorrect transaction details, receipt mismatch"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="form-control"
                  style={{ fontSize: '0.82rem', borderRadius: 8 }}
                />
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => handleVerifyAction('progress')}
                disabled={submitting}
                style={{ flex: 1, border: '1px solid #3b82f6', color: '#3b82f6', borderRadius: 8, padding: '10px 0', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Mark In-Progress
              </button>
              <button
                className="btn btn-sm"
                onClick={() => handleVerifyAction('reject')}
                disabled={submitting}
                style={{ flex: 1, background: '#ef4444', border: 'none', color: '#fff', borderRadius: 8, padding: '10px 0', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Reject Proof
              </button>
              <button
                className="btn btn-sm"
                onClick={() => handleVerifyAction('approve')}
                disabled={submitting}
                style={{ flex: 1.5, background: 'var(--success)', border: 'none', color: '#fff', borderRadius: 8, padding: '10px 0', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Approve & Mark Paid
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
