import { useState } from 'react';
import Layout from '../../components/Layout';
import { addDocument } from '../../firebase/firestore';
import { uploadMarksCard } from '../../firebase/storage';
import { toast } from 'react-hot-toast';
import { MdUpload, MdPictureAsPdf } from 'react-icons/md';

export default function AdminUploadMarksCards() {
  const [form, setForm] = useState({ student_id: '', student_name: '', semester: '' });
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!form.student_id || !form.semester || !file) return toast.error('Fill all fields and select a file');
    setUploading(true);
    try {
      const fileUrl = await uploadMarksCard(form.student_id, form.semester, file);
      await addDocument('marksCards', {
        student_id: form.student_id,
        student_name: form.student_name,
        semester: Number(form.semester),
        file_url: fileUrl,
      });
      toast.success('Marks card uploaded successfully!');
      setForm({ student_id: '', student_name: '', semester: '' });
      setFile(null);
    } catch (err) {
      toast.error('Upload failed: ' + err.message);
    } finally { setUploading(false); }
  };

  return (
    <Layout pageTitle="Upload Marks Cards">
      <h1 className="page-title">Upload Marks Cards</h1>
      <p className="page-subtitle">Upload semester result PDFs for students</p>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card card-lg">
          <h3 className="mb-16"><MdUpload style={{ verticalAlign: 'middle' }} /> Upload PDF</h3>
          <form onSubmit={handleUpload}>
            <div className="form-group">
              <label className="form-label">Student USN / UID *</label>
              <input className="form-control" placeholder="Student's Firestore UID or USN" value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Student Name</label>
              <input className="form-control" placeholder="For display purposes" value={form.student_name} onChange={(e) => setForm({ ...form, student_name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Semester *</label>
              <select className="form-control" value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })}>
                <option value="">Select semester</option>
                {[1,2,3,4,5,6,7,8].map((s) => <option key={s} value={s}>Semester {s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Marks Card PDF *</label>
              <label className="file-upload-area" htmlFor="marks-pdf">
                <div className="upload-icon"><MdPictureAsPdf style={{ fontSize: '2rem', color: 'var(--danger)' }} /></div>
                <p>{file ? file.name : 'Click to select PDF file'}</p>
                <input id="marks-pdf" type="file" accept=".pdf" style={{ display: 'none' }} onChange={(e) => setFile(e.target.files[0])} />
              </label>
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={uploading}>
              {uploading ? 'Uploading...' : 'Upload Marks Card'}
            </button>
          </form>
        </div>

        <div className="card">
          <h3 className="mb-16">📌 Instructions</h3>
          <div style={{ fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ padding: 12, background: 'var(--info-light)', borderRadius: 'var(--radius-sm)', color: '#0c5460' }}>
              <strong>Tip:</strong> Use the student's Firebase UID (from Firestore students collection) as the Student ID field.
            </div>
            <ul style={{ paddingLeft: 16, color: 'var(--text-secondary)', lineHeight: 2 }}>
              <li>Only PDF files are accepted</li>
              <li>File is stored in Firebase Storage</li>
              <li>Student can view and download from their portal</li>
              <li>Uploading for same semester & student will add a new record (not overwrite)</li>
            </ul>
          </div>
        </div>
      </div>
    </Layout>
  );
}
