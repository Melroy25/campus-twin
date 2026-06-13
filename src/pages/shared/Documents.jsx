import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { uploadFile } from '../../appwrite/storage';
import { queryDocuments, addDocument, deleteDocument, updateDocument } from '../../appwrite/database';
import { Query } from 'appwrite';
import { toast } from 'react-hot-toast';
import { 
  encryptText, decryptText, hashPassword, encryptPasswordWithSystemKey 
} from '../../utils/crypto';
import { 
  MdFolder, MdFolderOpen, MdCreateNewFolder, MdArrowBack, 
  MdInsertDriveFile, MdDelete, MdVisibility, MdAdd, 
  MdCloudUpload, MdWarning, MdArrowForward, MdLock, MdVpnKey, MdRefresh
} from 'react-icons/md';

export default function UserDocuments() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Cabinet auth states
  const [cabinetSettings, setCabinetSettings] = useState(null); // Document from cabinetSettings
  const [cabinetKey, setCabinetKey] = useState(sessionStorage.getItem('cabinet_key') || '');
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Setup / Unlock forms
  const [setupPassword, setSetupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [unlockPassword, setUnlockPassword] = useState('');
  const [submittingAuth, setSubmittingAuth] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  // Active folder / items states (decrypted)
  const [folders, setFolders] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [activeFolder, setActiveFolder] = useState(null); // decrypted folder object
  const [loadingData, setLoadingData] = useState(false);

  // Folder creation
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  // File upload
  const [docName, setDocName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [revealed, setRevealed] = useState(false);

  // Anti-Screenshot & Blur Overlay
  useEffect(() => {
    const handleBlur = () => {
      // Synchronously blur and hide the media first to beat OS screen capture
      const mediaEl = document.getElementById('secure-preview-media');
      if (mediaEl) {
        mediaEl.style.setProperty('filter', 'blur(60px)', 'important');
        mediaEl.style.setProperty('opacity', '0', 'important');
      }
      setRevealed(false); // Instantly reset reveal state on focus loss
      document.body.classList.add('cabinet-secure-lock');
    };
    const handleFocus = () => {
      document.body.classList.remove('cabinet-secure-lock');
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        const mediaEl = document.getElementById('secure-preview-media');
        if (mediaEl) {
          mediaEl.style.setProperty('filter', 'blur(60px)', 'important');
          mediaEl.style.setProperty('opacity', '0', 'important');
        }
        setRevealed(false);
        document.body.classList.add('cabinet-secure-lock');
      }
    };
    const handleMouseLeaveWindow = (e) => {
      // If mouse leaves the browser window entirely
      if (!e.relatedTarget || e.toElement === null) {
        const mediaEl = document.getElementById('secure-preview-media');
        if (mediaEl) {
          mediaEl.style.setProperty('filter', 'blur(60px)', 'important');
          mediaEl.style.setProperty('opacity', '0', 'important');
        }
        setRevealed(false);
        document.body.classList.add('cabinet-secure-lock');
      }
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('mouseleave', handleMouseLeaveWindow);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('mouseleave', handleMouseLeaveWindow);
      document.body.classList.remove('cabinet-secure-lock');
    };
  }, []);

  // Intercept screenshot keyboard shortcuts and modifier keys
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isPrintScreen = e.key === 'PrintScreen' || e.keyCode === 44;
      const isWinSnipping = (e.metaKey || e.winKey) && e.shiftKey && e.key.toLowerCase() === 's';
      const isMacSnipping = e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key);
      
      // If the user presses Meta (Windows/Cmd), Alt, Control, Shift, or PrintScreen,
      // we immediately blur the document to prevent OS screenshot capture of clear text.
      const isModifierOrScreenshotKey = 
        e.key === 'Meta' || 
        e.key === 'OS' || 
        e.key === 'Alt' || 
        e.key === 'Control' || 
        e.key === 'Shift' || 
        isPrintScreen ||
        isWinSnipping ||
        isMacSnipping ||
        e.metaKey ||
        e.altKey ||
        e.ctrlKey ||
        e.shiftKey;

      if (isModifierOrScreenshotKey) {
        // Synchronously blur and hide the media first to beat OS screen capture
        const mediaEl = document.getElementById('secure-preview-media');
        if (mediaEl) {
          mediaEl.style.setProperty('filter', 'blur(60px)', 'important');
          mediaEl.style.setProperty('opacity', '0', 'important');
        }
        setRevealed(false); // Instantly blur preview content
        document.body.classList.add('cabinet-secure-lock');
        
        try {
          navigator.clipboard.writeText('');
        } catch (err) {}
      }
    };

    window.addEventListener('keydown', handleKeyDown, true); // Use capture phase
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);

  // Fetch cabinet authentication configuration
  const fetchCabinetSettings = async () => {
    if (!currentUser?.uid) return;
    setLoadingSettings(true);
    try {
      const results = await queryDocuments('cabinetSettings', [
        Query.equal('uid', currentUser.uid)
      ]);
      if (results.length > 0) {
        setCabinetSettings(results[0]);
      } else {
        setCabinetSettings(null);
      }
    } catch (err) {
      console.error("Failed to load cabinet settings:", err);
      toast.error("Failed to verify cabinet status.");
    } finally {
      setLoadingSettings(false);
    }
  };

  useEffect(() => {
    fetchCabinetSettings();
  }, [currentUser]);

  // Load and decrypt cabinet contents
  const fetchAndDecryptData = async () => {
    if (!currentUser?.uid || !cabinetKey) return;
    setLoadingData(true);
    try {
      // 1. Fetch folders
      const rawFolders = await queryDocuments('documentFolders', [
        Query.equal('uid', currentUser.uid)
      ]);
      
      // Decrypt folders
      const decryptedFolders = [];
      for (const folder of rawFolders) {
        try {
          const decryptedName = await decryptText(folder.name, cabinetKey);
          decryptedFolders.push({
            ...folder,
            name: decryptedName
          });
        } catch (e) {
          decryptedFolders.push({
            ...folder,
            name: "[Decryption Failed]",
            isCorrupt: true
          });
        }
      }
      decryptedFolders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setFolders(decryptedFolders);

      // 2. Fetch documents
      const rawDocs = await queryDocuments('userDocuments', [
        Query.equal('uid', currentUser.uid)
      ]);

      // Decrypt documents
      const decryptedDocs = [];
      for (const doc of rawDocs) {
        try {
          const decryptedName = await decryptText(doc.name, cabinetKey);
          const decryptedUrl = await decryptText(doc.url, cabinetKey);
          decryptedDocs.push({
            ...doc,
            name: decryptedName,
            url: decryptedUrl
          });
        } catch (e) {
          decryptedDocs.push({
            ...doc,
            name: "[Decryption Failed]",
            url: "",
            isCorrupt: true
          });
        }
      }
      setDocuments(decryptedDocs);
    } catch (err) {
      console.error("Failed to decrypt cabinet contents:", err);
      toast.error("Failed to decrypt documents database.");
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (cabinetKey) {
      fetchAndDecryptData();
    }
  }, [currentUser, cabinetKey]);

  // Create password once
  const handleSetupPassword = async (e) => {
    e.preventDefault();
    if (setupPassword.length < 6) {
      return toast.error("Password must be at least 6 characters.");
    }
    if (setupPassword !== confirmPassword) {
      return toast.error("Passwords do not match.");
    }

    setSubmittingAuth(true);
    const loadToast = toast.loading("Initializing secure cabinet...");
    try {
      const hash = await hashPassword(setupPassword);
      const encryptedPass = await encryptPasswordWithSystemKey(setupPassword);

      await addDocument('cabinetSettings', {
        uid: currentUser.uid,
        password_hash: hash,
        encrypted_password: encryptedPass,
        reset_requested: false,
        createdAt: new Date().toISOString()
      });

      sessionStorage.setItem('cabinet_key', setupPassword);
      setCabinetKey(setupPassword);
      toast.success("Cabinet security configured successfully!", { id: loadToast });
      fetchCabinetSettings();
    } catch (err) {
      console.error(err);
      toast.error("Failed to set cabinet password.", { id: loadToast });
    } finally {
      setSubmittingAuth(false);
    }
  };

  // Unlock existing cabinet
  const handleUnlockCabinet = async (e) => {
    e.preventDefault();
    setSubmittingAuth(true);
    try {
      const hash = await hashPassword(unlockPassword);
      if (hash === cabinetSettings.password_hash) {
        sessionStorage.setItem('cabinet_key', unlockPassword);
        setCabinetKey(unlockPassword);
        toast.success("Cabinet unlocked successfully!");
      } else {
        toast.error("Incorrect cabinet password.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to verify password.");
    } finally {
      setSubmittingAuth(false);
    }
  };

  // Request Admin to retrieve password
  const handleRequestAdminReset = async () => {
    if (!cabinetSettings) return;
    setSubmittingAuth(true);
    try {
      await updateDocument('cabinetSettings', cabinetSettings.$id || cabinetSettings.id, {
        reset_requested: true
      });
      toast.success("Password recovery requested! Please ask the Admin to decrypt your credentials.");
      fetchCabinetSettings();
      setShowForgot(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit request.");
    } finally {
      setSubmittingAuth(false);
    }
  };

  // Wipe cabinet and start fresh
  const handleWipeCabinet = async () => {
    if (!window.confirm("⚠️ WARNING: This will permanently delete all folders and documents in your cabinet. This action is irreversible. Are you absolutely sure?")) return;
    if (!window.confirm("Confirm deletion of your encrypted cabinet. ALL DATA WILL BE LOST.")) return;

    setSubmittingAuth(true);
    const loadToast = toast.loading("Wiping cabinet data...");
    try {
      // 1. Fetch and delete folders
      const rawFolders = await queryDocuments('documentFolders', [Query.equal('uid', currentUser.uid)]);
      for (const folder of rawFolders) {
        await deleteDocument('documentFolders', folder.$id);
      }

      // 2. Fetch and delete documents
      const rawDocs = await queryDocuments('userDocuments', [Query.equal('uid', currentUser.uid)]);
      for (const doc of rawDocs) {
        await deleteDocument('userDocuments', doc.$id);
      }

      // 3. Delete settings doc
      if (cabinetSettings) {
        await deleteDocument('cabinetSettings', cabinetSettings.$id || cabinetSettings.id);
      }

      sessionStorage.removeItem('cabinet_key');
      setCabinetKey('');
      setCabinetSettings(null);
      setFolders([]);
      setDocuments([]);
      setActiveFolder(null);
      toast.success("Cabinet successfully wiped. You can now configure a new password.", { id: loadToast });
      setShowForgot(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to wipe cabinet.", { id: loadToast });
    } finally {
      setSubmittingAuth(false);
    }
  };

  // Handle folder creation (Encrypted)
  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim() || !cabinetKey) return;

    // Check duplicate
    if (folders.some(f => f.name.toLowerCase() === newFolderName.trim().toLowerCase())) {
      return toast.error("A folder with this name already exists.");
    }

    setCreatingFolder(true);
    try {
      // Encrypt folder name
      const encryptedName = await encryptText(newFolderName.trim(), cabinetKey);
      await addDocument('documentFolders', {
        uid: currentUser.uid,
        name: encryptedName,
        createdAt: new Date().toISOString()
      });
      setNewFolderName('');
      setShowNewFolder(false);
      toast.success("Folder created securely!");
      fetchAndDecryptData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to create folder.");
    } finally {
      setCreatingFolder(false);
    }
  };

  // Handle document upload (Encrypted)
  const handleUploadDocument = async (e) => {
    e.preventDefault();
    if (!selectedFile || !docName.trim() || !activeFolder || !cabinetKey) return;

    setUploadingDoc(true);
    const loadToast = toast.loading("Encrypting and uploading document...");

    try {
      // 1. Upload file to storage
      const url = await uploadFile(selectedFile);
      if (!url) throw new Error("File upload failed.");

      // 2. Encrypt metadata
      const encryptedName = await encryptText(docName.trim(), cabinetKey);
      const encryptedUrl = await encryptText(url, cabinetKey);

      // 3. Save to database using plaintext activeFolder.$id to link
      await addDocument('userDocuments', {
        uid: currentUser.uid,
        folder_name: activeFolder.$id || activeFolder.id, // Linked by plaintext unique ID
        name: encryptedName,
        url: encryptedUrl,
        file_type: selectedFile.type,
        createdAt: new Date().toISOString()
      });

      setDocName('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast.success("Document encrypted and uploaded successfully!", { id: loadToast });
      fetchAndDecryptData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload: " + err.message, { id: loadToast });
    } finally {
      setUploadingDoc(false);
    }
  };

  // Delete document
  const handleDeleteDoc = async (docId) => {
    if (!window.confirm("Are you sure you want to delete this document?")) return;
    const loadToast = toast.loading("Deleting document...");
    try {
      await deleteDocument('userDocuments', docId);
      toast.success("Document deleted!", { id: loadToast });
      fetchAndDecryptData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete document.", { id: loadToast });
    }
  };

  // Delete folder
  const handleDeleteFolder = async (folder, e) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete folder "${folder.name}"? This cascades to all documents inside.`)) return;

    const loadToast = toast.loading("Deleting folder and contents...");
    try {
      const docsInFolder = documents.filter(d => d.folder_name === (folder.$id || folder.id));
      for (const doc of docsInFolder) {
        await deleteDocument('userDocuments', doc.$id || doc.id);
      }
      await deleteDocument('documentFolders', folder.$id || folder.id);
      toast.success("Folder deleted securely!", { id: loadToast });
      if (activeFolder?.id === folder.id || activeFolder?.$id === folder.$id) {
        setActiveFolder(null);
      }
      fetchAndDecryptData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete folder.", { id: loadToast });
    }
  };

  // Count documents in a folder (matched by folder ID)
  const getDocCount = (folderId) => {
    return documents.filter(d => d.folder_name === folderId).length;
  };

  // Lock session manually
  const handleLockSession = () => {
    sessionStorage.removeItem('cabinet_key');
    setCabinetKey('');
    setUnlockPassword('');
    setActiveFolder(null);
    toast.success("Cabinet locked.");
  };

  return (
    <Layout pageTitle="Encrypted Cabinet">
      {/* Styles injecting anti-screenshot and print blocker */}
      <style>{`
        @media print {
          body { display: none !important; }
        }
        body.cabinet-secure-lock {
          filter: blur(60px) brightness(0) !important;
          background: #000 !important;
          pointer-events: none !important;
        }
      `}</style>

      <div 
        style={{ maxWidth: 900, margin: '20px auto', padding: '0 16px', userSelect: 'none' }}
        onContextMenu={(e) => e.preventDefault()}
        onCopy={(e) => {
          e.preventDefault();
          toast.error("Copying is disabled for security reasons.");
        }}
      >
        {/* Maintenance banner */}
        {userProfile?.maintenance && (
          <div style={{
            background: 'rgba(255, 107, 107, 0.15)', border: '1px solid #ff6b6b', color: '#ff6b6b',
            padding: '14px 20px', borderRadius: '12px', marginBottom: '24px', fontSize: '0.9rem',
            fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            boxShadow: '0 4px 12px rgba(255,107,107,0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <MdWarning size={20} />
              <span>🚧 <strong>Bypass Active:</strong> Maintenance Mode. Only the Document Cabinet is accessible.</span>
            </div>
            <button 
              type="button" onClick={() => navigate('/maintenance')}
              style={{
                background: '#ff6b6b', color: '#fff', border: 'none', padding: '6px 14px',
                borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600, transition: 'transform 0.1s'
              }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              Return to Status
            </button>
          </div>
        )}

        {/* LOADING AUTH CONFIG STATE */}
        {loadingSettings ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 260 }}>
            <div className="spinner" style={{ borderTopColor: 'var(--cb-primary)' }}></div>
          </div>
        ) : (
          <>
            {/* VIEW A: CONFIGURE NEW PASSWORD (CREATE ONCE) */}
            {!cabinetSettings && (
              <div className="card" style={{ maxWidth: 480, margin: '40px auto', padding: '32px 24px', textAlign: 'center' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: '50%', background: 'rgba(79, 110, 247, 0.1)', color: 'var(--cb-primary)', marginBottom: 20 }}>
                  <MdLock size={36} />
                </div>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 8 }}>Setup Encrypted Cabinet</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: 24 }}>
                  Establish a secure master password. All files, links, and folder names will be encrypted client-side using AES-GCM. <strong>If forgotten, access recovery requires Admin authorization.</strong>
                </p>

                <form onSubmit={handleSetupPassword} style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'left' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Create Master Password</label>
                    <input 
                      type="password" className="form-control" placeholder="Minimum 6 characters..."
                      value={setupPassword} onChange={(e) => setSetupPassword(e.target.value)} required disabled={submittingAuth}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Confirm Password</label>
                    <input 
                      type="password" className="form-control" placeholder="Confirm master password..."
                      value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required disabled={submittingAuth}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary btn-block" style={{ padding: 12, fontWeight: 600 }} disabled={submittingAuth}>
                    {submittingAuth ? 'Configuring Cabinet...' : 'Configure Cabinet'}
                  </button>
                </form>
              </div>
            )}

            {/* VIEW B: UNLOCK CABINET FOR SESSION */}
            {cabinetSettings && !cabinetKey && (
              <div className="card" style={{ maxWidth: 450, margin: '40px auto', padding: '32px 24px', textAlign: 'center' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 60, height: 60, borderRadius: '50%', background: 'var(--surface-2)', border: '2px solid var(--border)', color: 'var(--text-primary)', marginBottom: 18 }}>
                  <MdVpnKey size={30} />
                </div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 6 }}>Unlock Document Cabinet</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: 20 }}>
                  Enter your cabinet master password to decrypt files.
                </p>

                {cabinetSettings.reset_requested && (
                  <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid #f59e0b', color: '#d97706', padding: '8px 12px', borderRadius: 6, fontSize: '0.75rem', marginBottom: 16, fontWeight: 500 }}>
                    ⏳ Password retrieval requested from Admin. Share your USN to retrieve it.
                  </div>
                )}

                <form onSubmit={handleUnlockCabinet} style={{ display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'left' }}>
                  <div className="form-group" style={{ marginBottom: 4 }}>
                    <input 
                      type="password" className="form-control" placeholder="Cabinet master password..."
                      value={unlockPassword} onChange={(e) => setUnlockPassword(e.target.value)} required disabled={submittingAuth} autoFocus
                    />
                  </div>
                  <button type="submit" className="btn btn-primary btn-block" style={{ padding: 10, fontWeight: 600 }} disabled={submittingAuth}>
                    {submittingAuth ? 'Unlocking...' : 'Unlock'}
                  </button>
                </form>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                  <button 
                    type="button" className="btn btn-ghost btn-sm" 
                    onClick={() => setShowForgot(!showForgot)}
                    style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
                  >
                    Forgot Password?
                  </button>
                  <button 
                    type="button" className="btn btn-ghost btn-sm"
                    onClick={() => navigate(-1)}
                    style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
                  >
                    Cancel
                  </button>
                </div>

                {showForgot && (
                  <div className="card" style={{ background: 'var(--surface-2)', border: '1px dashed var(--border)', padding: 16, marginTop: 16, textAlign: 'left' }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 8 }}>Cabinet Password Reset Options</h4>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4, marginBottom: 12 }}>
                      1. **Request Admin Retrieval**: Send a request so the Admin can securely decrypt and show you your password.<br />
                      2. **Wipe Cabinet**: Reset the cabinet to set a new password, but all old files will be permanently lost.
                    </p>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button 
                        type="button" className="btn btn-sm" style={{ background: '#f59e0b', color: 'white', flex: 1, fontSize: '0.72rem' }}
                        onClick={handleRequestAdminReset} disabled={submittingAuth || cabinetSettings.reset_requested}
                      >
                        Request Admin Retrieval
                      </button>
                      <button 
                        type="button" className="btn btn-sm btn-outline" style={{ color: 'var(--danger)', flex: 1, fontSize: '0.72rem' }}
                        onClick={handleWipeCabinet} disabled={submittingAuth}
                      >
                        Wipe Cabinet Data
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* VIEW C: MAIN CABINET VIEW (UNLOCKED) */}
            {cabinetSettings && cabinetKey && (
              <>
                {/* Heading Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                  <div>
                    <h2 style={{ fontSize: '1.6rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
                      🔐 Document Cabinet <span style={{ fontSize: '0.75rem', background: '#3f9f7f20', color: '#3f9f7f', padding: '2px 8px', borderRadius: 12, border: '1px solid #3f9f7f40' }}>AES-256 Encrypted</span>
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: 4 }}>
                      End-to-End client-side encryption is active. Your data is invisible to unauthorized users and database admins.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button 
                      onClick={handleLockSession}
                      className="btn btn-outline btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                      title="Lock Cabinet Session"
                    >
                      <MdLock size={14} /> Lock Session
                    </button>
                    {!activeFolder && (
                      <button 
                        onClick={() => setShowNewFolder(!showNewFolder)}
                        className="btn btn-primary btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <MdCreateNewFolder size={16} /> New Folder
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline Folder Creation Form */}
                {showNewFolder && !activeFolder && (
                  <form onSubmit={handleCreateFolder} className="card" style={{ marginBottom: 24, padding: 18, background: 'var(--surface-2)', border: '1px dashed var(--cb-primary)', borderRadius: 'var(--radius)' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 12 }}>Create Secure Folder</h4>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <input 
                        type="text" 
                        className="form-control"
                        placeholder="Folder Name (e.g. Personal Certificates, Tax Proofs)..."
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        maxLength={40}
                        required
                        style={{ flex: 1 }}
                      />
                      <button type="submit" className="btn btn-primary" disabled={creatingFolder}>
                        {creatingFolder ? 'Creating...' : 'Create'}
                      </button>
                      <button type="button" className="btn btn-outline" onClick={() => setShowNewFolder(false)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {loadingData ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
                    <div className="spinner" style={{ borderTopColor: 'var(--cb-primary)' }}></div>
                  </div>
                ) : (
                  <>
                    {/* View 1: Folders Grid */}
                    {!activeFolder && (
                      <>
                        {folders.length === 0 ? (
                          <div className="card" style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--surface-2)', border: '1px dashed var(--border)' }}>
                            <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔒</div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Your Encrypted Cabinet is Empty</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: 380, margin: '8px auto 20px' }}>
                              Organize certificates or proofs. File structures are hidden under AES keys.
                            </p>
                            <button onClick={() => setShowNewFolder(true)} className="btn btn-primary">
                              <MdAdd size={16} /> Create Folder
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
                            {folders.map((folder) => (
                              <div 
                                key={folder.id || folder.$id} 
                                className="card"
                                onClick={() => !folder.isCorrupt && setActiveFolder(folder)}
                                style={{
                                  margin: 0,
                                  cursor: folder.isCorrupt ? 'not-allowed' : 'pointer',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  justifyContent: 'space-between',
                                  padding: 20,
                                  border: '1px solid var(--border)',
                                  borderRadius: 'var(--radius)',
                                  transition: 'transform 0.2s, border-color 0.2s',
                                  boxShadow: 'var(--shadow-sm)',
                                  position: 'relative'
                                }}
                                onMouseOver={(e) => {
                                  if (!folder.isCorrupt) {
                                    e.currentTarget.style.transform = 'translateY(-4px)';
                                    e.currentTarget.style.borderColor = 'var(--cb-primary)';
                                  }
                                }}
                                onMouseOut={(e) => {
                                  if (!folder.isCorrupt) {
                                    e.currentTarget.style.transform = 'none';
                                    e.currentTarget.style.borderColor = 'var(--border)';
                                  }
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: '10px', background: folder.isCorrupt ? 'rgba(239, 68, 68, 0.1)' : 'rgba(79, 110, 247, 0.1)', color: folder.isCorrupt ? '#ef4444' : 'var(--cb-primary)' }}>
                                    <MdFolder size={26} />
                                  </div>
                                  <div>
                                    <strong style={{ fontSize: '1rem', color: 'var(--text-primary)', display: 'block', wordBreak: 'break-word', paddingRight: 24 }}>
                                      {folder.name}
                                    </strong>
                                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                      {folder.isCorrupt ? "Key error" : `${getDocCount(folder.$id || folder.id)} documents`}
                                    </span>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                    Created: {new Date(folder.createdAt).toLocaleDateString()}
                                  </span>
                                  <div style={{ display: 'flex', gap: 8 }}>
                                    <button 
                                      type="button"
                                      onClick={(e) => handleDeleteFolder(folder, e)}
                                      style={{ border: 'none', background: 'none', color: 'var(--danger)', opacity: 0.7, cursor: 'pointer', padding: 4 }}
                                      title="Delete Folder"
                                      onMouseOver={(e) => e.currentTarget.style.opacity = 1}
                                      onMouseOut={(e) => e.currentTarget.style.opacity = 0.7}
                                    >
                                      <MdDelete size={16} />
                                    </button>
                                    {!folder.isCorrupt && <MdArrowForward size={16} style={{ color: 'var(--text-muted)' }} />}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {/* View 2: Inside Active Folder */}
                    {activeFolder && (
                      <div>
                        {/* Back Breadcrumbs */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                          <button 
                            type="button"
                            onClick={() => setActiveFolder(null)}
                            style={{ background: 'none', border: 'none', color: 'var(--cb-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, fontSize: '0.9rem', padding: 0 }}
                          >
                            <MdArrowBack size={18} /> Back to Cabinet
                          </button>
                          <span style={{ color: 'var(--text-muted)' }}>/</span>
                          <strong style={{ fontSize: '0.95rem' }}>{activeFolder.name}</strong>
                        </div>

                        {/* Grid for Upload panel & Documents list */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24, alignItems: 'start' }}>
                          
                          {/* Left panel: Upload Form */}
                          <div className="card" style={{ margin: 0, padding: 20, border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface-2)' }}>
                            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                              📤 Secure Upload
                            </h3>
                            <form onSubmit={handleUploadDocument} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                              <div>
                                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Document Title</label>
                                <input 
                                  type="text"
                                  className="form-control"
                                  placeholder="e.g. Personal ID card..."
                                  value={docName}
                                  onChange={(e) => setDocName(e.target.value)}
                                  required
                                  disabled={uploadingDoc}
                                />
                              </div>

                              <div>
                                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Select File (Image or PDF)</label>
                                <div 
                                  onClick={() => !uploadingDoc && fileInputRef.current?.click()}
                                  style={{
                                    border: '2px dashed var(--border)',
                                    borderRadius: 'var(--radius)',
                                    padding: '24px 12px',
                                    textAlign: 'center',
                                    cursor: uploadingDoc ? 'not-allowed' : 'pointer',
                                    background: selectedFile ? 'rgba(79, 110, 247, 0.05)' : 'var(--surface)',
                                    borderColor: selectedFile ? 'var(--cb-primary)' : 'var(--border)',
                                    transition: 'all 0.2s'
                                  }}
                                >
                                  <MdCloudUpload size={32} style={{ color: selectedFile ? 'var(--cb-primary)' : 'var(--text-muted)', marginBottom: 8 }} />
                                  <p style={{ fontSize: '0.78rem', color: selectedFile ? 'var(--text-primary)' : 'var(--text-muted)', wordBreak: 'break-all' }}>
                                    {selectedFile ? selectedFile.name : 'Click to select image/PDF'}
                                  </p>
                                </div>
                                <input 
                                  type="file"
                                  ref={fileInputRef}
                                  style={{ display: 'none' }}
                                  accept="image/*,application/pdf"
                                  onChange={(e) => setSelectedFile(e.target.files[0])}
                                  disabled={uploadingDoc}
                                />
                              </div>

                              <button 
                                type="submit" 
                                className="btn btn-primary" 
                                disabled={uploadingDoc || !selectedFile || !docName.trim()}
                                style={{ marginTop: 6 }}
                              >
                                {uploadingDoc ? 'Encrypting & Uploading...' : 'Upload Document'}
                              </button>
                            </form>
                          </div>

                          {/* Right panel: Documents Grid */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div className="card" style={{ margin: 0, padding: '12px 18px', background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Documents in this folder</span>
                              <span className="badge badge-primary">{documents.filter(d => d.folder_name === (activeFolder.$id || activeFolder.id)).length} total</span>
                            </div>

                            {documents.filter(d => d.folder_name === (activeFolder.$id || activeFolder.id)).length === 0 ? (
                              <div className="card" style={{ textAlign: 'center', padding: '50px 20px', background: 'var(--surface-2)', border: '1px dashed var(--border)' }}>
                                <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>🔒</div>
                                <strong style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>No Documents Saved</strong>
                                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                  Files inside this folder are protected by your master security key.
                                </p>
                              </div>
                            ) : (
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                {documents
                                  .filter(d => d.folder_name === (activeFolder.$id || activeFolder.id))
                                  .map((doc) => {
                                    const isPdf = doc.file_type?.includes('pdf') || doc.url?.toLowerCase().includes('.pdf');
                                    return (
                                      <div 
                                        key={doc.id || doc.$id} 
                                        className="card"
                                        style={{
                                          margin: 0,
                                          padding: 16,
                                          border: '1px solid var(--border)',
                                          borderRadius: 'var(--radius)',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          justifyContent: 'space-between',
                                          boxShadow: 'var(--shadow-sm)'
                                        }}
                                      >
                                        <div>
                                          {/* Document Preview (thumbnail for image, icon for PDF) */}
                                          <div style={{
                                            height: 120,
                                            borderRadius: '6px',
                                            background: 'var(--surface-2)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            overflow: 'hidden',
                                            border: '1px solid var(--border)',
                                            marginBottom: 12
                                          }}>
                                            {isPdf ? (
                                              <div style={{ textAlign: 'center', color: '#ff4d4d' }}>
                                                <MdInsertDriveFile size={40} />
                                                <div style={{ fontSize: '0.65rem', fontWeight: 700, marginTop: 4 }}>PDF DOCUMENT</div>
                                              </div>
                                            ) : doc.isCorrupt ? (
                                              <div style={{ color: 'var(--danger)' }}>Decryption key error</div>
                                            ) : (
                                              <img 
                                                src={doc.url} alt={doc.name} 
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                                onDragStart={(e) => e.preventDefault()}
                                              />
                                            )}
                                          </div>

                                          <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)', display: 'block', wordBreak: 'break-word', lineHeight: 1.2, marginBottom: 4 }}>
                                            {doc.name}
                                          </strong>
                                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                            Uploaded: {new Date(doc.createdAt).toLocaleDateString()}
                                          </span>
                                        </div>

                                        <div style={{ display: 'flex', gap: 8, marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                                          {!doc.isCorrupt && (
                                            <button 
                                              type="button"
                                              onClick={() => setPreviewDoc(doc)}
                                              className="btn btn-outline btn-sm"
                                              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '4px 8px', fontSize: '0.75rem' }}
                                            >
                                              <MdVisibility size={14} /> Open
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            className="btn btn-sm"
                                            onClick={() => handleDeleteDoc(doc.id || doc.$id)}
                                            style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: 'none', padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            title="Delete File"
                                          >
                                            <MdDelete size={14} />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Secure Inline Document Preview Modal */}
      {previewDoc && (
        <div 
          onMouseLeave={() => {
            // Instantly blur when mouse leaves the browser window/modal area
            const mediaEl = document.getElementById('secure-preview-media');
            if (mediaEl) {
              mediaEl.style.setProperty('filter', 'blur(60px)', 'important');
              mediaEl.style.setProperty('opacity', '0', 'important');
            }
            setRevealed(false);
          }}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.95)', zIndex: 10000,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: 24, userSelect: 'none'
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* Diagonal Watermarks */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            pointerEvents: 'none', overflow: 'hidden', zIndex: 5,
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            gridTemplateRows: 'repeat(4, 1fr)', gap: '40px',
            opacity: 0.1, transform: 'rotate(-25deg) scale(1.2)'
          }}>
            {Array.from({ length: 12 }).map((_, idx) => (
              <div 
                key={idx} 
                style={{
                  fontSize: '0.8rem', color: '#fff', fontWeight: 700,
                  whiteSpace: 'nowrap', textTransform: 'uppercase',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                {`CONFIDENTIAL • ${userProfile?.name || 'STUDENT'} (${userProfile?.usn || 'USN'}) • ${new Date().toLocaleDateString()}`}
              </div>
            ))}
          </div>

          <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 10, display: 'flex', gap: 12 }}>
            {!previewDoc.isCorrupt && (
              <a 
                href={previewDoc.url} 
                download={previewDoc.name}
                target="_blank"
                rel="noopener noreferrer"
                className="btn"
                style={{ 
                  background: 'linear-gradient(135deg, var(--primary) 0%, #8b5cf6 100%)', 
                  color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8, 
                  textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
                  fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem'
                }}
              >
                Download File
              </a>
            )}
            <button 
              type="button"
              className="btn btn-outline" 
              onClick={() => {
                setPreviewDoc(null);
                setRevealed(false); // Reset reveal on close
              }}
              style={{ background: 'rgba(255, 255, 255, 0.15)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem' }}
            >
              Close Preview
            </button>
          </div>
          
          <div style={{
            maxWidth: '90%', maxHeight: '75vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#000', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)',
            position: 'relative', padding: 10
          }}>
            {previewDoc.url && (previewDoc.url.toLowerCase().includes('.pdf') || previewDoc.name.toLowerCase().includes('.pdf')) ? (
              <iframe 
                id="secure-preview-media"
                src={previewDoc.url} 
                style={{ 
                  width: '80vw', height: '65vh', border: 'none', background: 'white',
                  filter: revealed ? 'none' : 'blur(40px)', transition: 'filter 0.15s ease'
                }}
                title="PDF Preview"
              />
            ) : (
              <img 
                id="secure-preview-media"
                src={previewDoc.url} 
                alt={previewDoc.name} 
                style={{ 
                  maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain', pointerEvents: 'none',
                  filter: revealed ? 'none' : 'blur(40px)', transition: 'filter 0.15s ease'
                }} 
                onContextMenu={(e) => e.preventDefault()}
              />
            )}
          </div>
          
          {/* Reveal Toggle Button */}
          <button
            type="button"
            onClick={() => {
              const nextState = !revealed;
              setRevealed(nextState);
              // Clear any direct DOM style overrides
              const mediaEl = document.getElementById('secure-preview-media');
              if (mediaEl) {
                mediaEl.style.filter = '';
                mediaEl.style.opacity = '';
              }
            }}
            style={{
              background: revealed ? 'var(--primary)' : 'rgba(255, 255, 255, 0.15)',
              color: '#fff', padding: '12px 24px', borderRadius: 8, border: 'none',
              marginTop: 18, fontWeight: 600, cursor: 'pointer', zIndex: 10,
              userSelect: 'none', WebkitUserSelect: 'none'
            }}
          >
            {revealed ? 'Click to Blur Document' : 'Click to Reveal Document'}
          </button>
          
          <div style={{ color: '#fff', marginTop: 12, textAlign: 'center', zIndex: 10 }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 4 }}>{previewDoc.name}</h3>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Secure Cabinet Inline Viewer (Anti-Screenshot active)</p>
          </div>
        </div>
      )}
    </Layout>
  );
}
