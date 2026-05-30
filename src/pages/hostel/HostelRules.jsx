import { useState, useEffect } from 'react';
import { queryDocuments, addDocument, updateDocument, deleteDocument } from '../../appwrite/database';
import { uploadFile } from '../../appwrite/storage';
import { Query } from 'appwrite';
import { toast } from 'react-hot-toast';
import {
  MdBook, MdExpandMore, MdExpandLess, MdDownload,
  MdWarning, MdPhone, MdSecurity, MdLocalHospital, MdCampaign,
  MdAdd, MdEdit, MdDelete, MdClose, MdContentCopy, MdUpload
} from 'react-icons/md';

export default function HostelRules({ hostelType, role }) {
  const accent = hostelType === 'girls' ? '#ec4899' : '#3b82f6';
  const accentLight = hostelType === 'girls' ? '#fce7f3' : '#dbeafe';
  const accentDark = hostelType === 'girls' ? '#be185d' : '#1e40af';

  const [expandedSection, setExpandedSection] = useState('general');
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(false);

  // Helplines CRUD states
  const [helplines, setHelplines] = useState([]);
  const [loadingHelplines, setLoadingHelplines] = useState(true);
  const [showHelplineModal, setShowHelplineModal] = useState(false);
  const [editingHelpline, setEditingHelpline] = useState(null);
  const [label, setLabel] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  // Dynamic Rules State
  const [ruleSections, setRuleSections] = useState([]);
  const [loadingRules, setLoadingRules] = useState(true);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [ruleTitle, setRuleTitle] = useState('');
  const [ruleItems, setRuleItems] = useState(['']); // Array of strings
  const [savingRule, setSavingRule] = useState(false);

  // PDF State
  const [pdfUrl, setPdfUrl] = useState('');
  const [uploadingPdf, setUploadingPdf] = useState(false);


  const fetchHelplines = async () => {
    setLoadingHelplines(true);
    try {
      const data = await queryDocuments('hostelHelplines', [
        Query.equal('hostel_type', hostelType)
      ]);
      
      if (data.length === 0) {
        // Seed default helplines to database if empty
        const defaults = [
          { label: 'Block Office / Security Desk', phone: hostelType === 'girls' ? '+91 98765 43211' : '+91 98765 43210', email: `${hostelType}warden@college.edu` },
          { label: 'Campus Health Clinic (24x7)', phone: '+91 98765 43219', email: 'clinic@college.edu' },
          { label: 'Ambulance Emergency Hotline', phone: '+91 98765 43220', email: 'ambulance@college.edu' }
        ];
        const seeded = [];
        for (const item of defaults) {
          const newDoc = {
            helpline_id: `help_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            label: item.label,
            phone: item.phone,
            email: item.email,
            hostel_type: hostelType,
            createdAt: new Date().toISOString()
          };
          const doc = await addDocument('hostelHelplines', newDoc);
          seeded.push(doc);
        }
        setHelplines(seeded);
      } else {
        setHelplines(data);
      }
    } catch (err) {
      console.warn("Failed to load helplines:", err);
    } finally {
      setLoadingHelplines(false);
    }
  };

  useEffect(() => {
    const fetchNotices = async () => {
      try {
        const data = await queryDocuments('hostelNotices', [
          Query.equal('hostel_type', hostelType)
        ]);
        // Filter out system account settings entries
        const bulletinsOnly = data.filter(n => n.title && !n.title.startsWith('account_settings_'));
        setNotices(bulletinsOnly);
      } catch (err) {
        console.warn("Failed to load rules notices:", err);
      }
    };
    fetchNotices();
    fetchHelplines();
    fetchRulesAndPdf();
  }, [hostelType]);

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  
  const handleDownloadPDF = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    } else {
      toast.error('No PDF has been uploaded yet for this block.');
    }
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== 'application/pdf') return toast.error("Please upload a valid PDF file");
    
    setUploadingPdf(true);
    const toastId = toast.loading('Uploading PDF...');
    try {
      const url = await uploadFile(file);
      
      const configKey = `rules_pdf_${hostelType}`;
      const exist = await queryDocuments('hostelConfig', [Query.equal('key', configKey)]);
      if (exist.length > 0) {
        await updateDocument('hostelConfig', exist[0].$id, { value: url });
      } else {
        await addDocument('hostelConfig', { key: configKey, value: url });
      }
      setPdfUrl(url);
      toast.success('PDF updated successfully', { id: toastId });
    } catch (err) {
      toast.error('Failed to upload PDF', { id: toastId });
      console.error(err);
    } finally {
      setUploadingPdf(false);
    }
  };

  const handleEditRule = (sec) => {
    setEditingRuleId(sec.$id);
    setRuleTitle(sec.title);
    setRuleItems([...sec.rules]);
    setShowRuleModal(true);
  };

  const handleDeleteRule = async (id) => {
    if (!window.confirm("Are you sure you want to delete this rule section?")) return;
    try {
      await deleteDocument('hostelRules', id);
      toast.success('Rule section deleted');
      setRuleSections(prev => prev.filter(r => r.$id !== id));
    } catch (err) {
      toast.error('Failed to delete rule section');
    }
  };

  const handleSaveRule = async () => {
    if (!ruleTitle.trim()) return toast.error("Title is required");
    const validRules = ruleItems.filter(r => r.trim() !== '');
    if (validRules.length === 0) return toast.error("At least one rule is required");
    
    setSavingRule(true);
    try {
      if (editingRuleId) {
        await updateDocument('hostelRules', editingRuleId, {
          title: ruleTitle,
          rules: validRules
        });
        toast.success("Rule section updated");
      } else {
        await addDocument('hostelRules', {
          title: ruleTitle,
          rules: validRules,
          hostel_type: hostelType,
          order: ruleSections.length,
          createdAt: new Date().toISOString()
        });
        toast.success("Rule section added");
      }
      setShowRuleModal(false);
      fetchRulesAndPdf(); // reload
    } catch(err) {
      toast.error("Failed to save rule section");
    } finally {
      setSavingRule(false);
    }
  };


  const handleEditHelpline = (help) => {
    setEditingHelpline(help);
    setLabel(help.label);
    setPhone(help.phone || '');
    setEmail(help.email || '');
    setShowHelplineModal(true);
  };

  const handleDeleteHelpline = async (id) => {
    if (!window.confirm("Are you sure you want to delete this helpline contact?")) return;
    try {
      await deleteDocument('hostelHelplines', id);
      toast.success("Helpline deleted successfully");
      fetchHelplines();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete helpline contact");
    }
  };

  const handleSaveHelpline = async (e) => {
    e.preventDefault();
    if (!label.trim()) return toast.error("Label/Name is required");
    setSaving(true);
    try {
      if (editingHelpline) {
        await updateDocument('hostelHelplines', editingHelpline.$id || editingHelpline.id, {
          label: label.trim(),
          phone: phone.trim(),
          email: email.trim()
        });
        toast.success("Helpline contact updated successfully");
      } else {
        await addDocument('hostelHelplines', {
          helpline_id: `help_${Date.now()}`,
          label: label.trim(),
          phone: phone.trim(),
          email: email.trim(),
          hostel_type: hostelType,
          createdAt: new Date().toISOString()
        });
        toast.success("Helpline contact added successfully");
      }
      setShowHelplineModal(false);
      setEditingHelpline(null);
      setLabel('');
      setPhone('');
      setEmail('');
      fetchHelplines();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save helpline contact");
    } finally {
      setSaving(false);
    }
  };

  
  const fetchRulesAndPdf = async () => {
    setLoadingRules(true);
    try {
      // Fetch Rules
      const data = await queryDocuments('hostelRules', [
        Query.equal('hostel_type', hostelType)
      ]);
      if (data.length === 0) {
        // Seed default rules
        const defaultRules = [
    {
      id: 'general', title: '1. General Curfew & Attendance Rules',
      rules: [
        'Curfew Timings: Students must return to the hostel premises before 8:00 PM daily. Any late arrival will incur penalty fines.',
        'Daily Attendance: Bio-metric attendance is mandatory and is marked at the block entrances between 8:30 PM and 9:45 PM.',
        'Visitors Policy: Only registered parents and local guardians are allowed in the visitor parlor. Strict prohibition of visitors inside student corridors/rooms.',
        'Silence Hours: Complete silence must be maintained in study wings and corridors from 10:30 PM to 6:00 AM.',
        'Identity Cards: Students must carry and display their Hostel Resident Smart Card at security checkpoints upon request.'
      ]
    },
    {
      id: 'property', title: '2. Room Property & Code of Conduct',
      rules: [
        'Room Maintenance: Students are solely responsible for keeping their assigned rooms tidy and clean. Floor inspections are conducted weekly.',
        'Electrical Appliances: Use of heavy electrical equipment (heaters, iron boxes, coolers, induction stoves) is strictly banned to prevent fire hazards.',
        'Asset Damages: Any defacing of walls, hammering nails, or tampering with room assets will attract a full damage replacement fine.',
        'Energy Conservation: Fans, lights, and AC units must be turned off when leaving the room. Failure will incur a penalty fine.',
        'Key Custody: Loss of room keys must be reported immediately. Key duplicating or locks replacement has to be overseen by the block warden.'
      ]
    },
    {
      id: 'leaves', title: '3. Outstation Leave Clearance Protocol',
      rules: [
        'Leave Prior Request: Outstation leave requests must be submitted online through the Campus Twin portal at least 24 hours prior to departure.',
        'Parent Consent: The warden office reserves the right to call registered parent phone numbers for consent validation prior to approving outstation logs.',
        'Emergency Exit: In case of medical emergencies, students can request an instant warden override and gate exit coupon.',
        'Return Reporting: Upon return, students must mark biometric arrival at the main security log within 30 minutes of entry.'
      ]
    },
    {
      id: 'dining', title: '4. Mess & Dining Regulations',
      rules: [
        'Dining Timings: Breakfast: 7:00 AM - 9:00 AM | Lunch: 12:30 PM - 2:00 PM | Snacks: 5:00 PM - 6:00 PM | Dinner: 7:30 PM - 9:30 PM.',
        'Cleanliness: Food wastes must be disposed of only in organic waste bins. Plates and cups must be kept on washing trays.',
        'Mess Outings: Mess food is strictly meant for consumption inside the dining hall. No food plates are allowed to be taken to individual rooms.',
        'Ethical Feeding: Respect staff and dining peers. Avoid arguments. Any suggestions must be directed through the Student Mess Committee.'
      ]
    }
  ];
        const seeded = [];
        for (let i = 0; i < defaultRules.length; i++) {
          const item = defaultRules[i];
          const newDoc = await addDocument('hostelRules', {
            title: item.title,
            rules: item.rules,
            hostel_type: hostelType,
            order: i,
            createdAt: new Date().toISOString()
          });
          seeded.push(newDoc);
        }
        setRuleSections(seeded);
      } else {
        setRuleSections(data.sort((a, b) => a.order - b.order));
      }

      // Fetch PDF
      const pdfData = await queryDocuments('hostelConfig', [
        Query.equal('key', `rules_pdf_${hostelType}`)
      ]);
      if (pdfData.length > 0) {
        setPdfUrl(pdfData[0].value);
      }
    } catch (err) {
      console.warn("Failed to load rules/pdf:", err);
    } finally {
      setLoadingRules(false);
    }
  };


  const glassCard = (extra = {}) => ({
    background: 'var(--surface-1)',
    borderRadius: 16,
    padding: 20,
    boxShadow: 'var(--shadow-md)',
    border: '1px solid var(--border)',
    transition: 'all 0.3s ease',
    ...extra
  });

  return (
    <div style={{ padding: '24px 16px', maxWidth: 1000, margin: '0 auto', animation: 'fadeIn 0.4s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}>
        <div>
          <h1 className="page-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <MdBook style={{ color: accent }} /> Resident Rule Book
          </h1>
          <p className="page-subtitle" style={{ margin: '4px 0 0' }}>
            Official guidelines, code of conduct, and safety helplines for Campus Twin residents
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {(role === 'warden' || role === 'admin') && (
            <div>
              <input type="file" id="pdf-upload" accept="application/pdf" style={{ display: 'none' }} onChange={handlePdfUpload} disabled={uploadingPdf} />
              <label htmlFor="pdf-upload" className="btn btn-ghost" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <MdUpload /> {uploadingPdf ? 'Uploading...' : 'Upload New PDF'}
              </label>
            </div>
          )}
          <button
            className="btn btn-outline"
            onClick={handleDownloadPDF}
            style={{ borderColor: accent, color: accent, display: 'flex', alignItems: 'center', gap: 6, borderRadius: 20 }}
          >
            <MdDownload /> Download Code PDF
          </button>
        </div>

      </div>


      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24, flexWrap: 'wrap' }}>
        {/* Accordions */}
        <div>
          <h3 style={{ fontSize: '0.94rem', fontWeight: 700, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
            <MdBook style={{ color: accent }} /> Hostel Code of Conduct
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {loadingRules ? (<div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)' }}>Loading rules...</div>) : ruleSections.map((sec) => {
              const isExpanded = expandedSection === ((sec.id || sec.$id) || sec.$id);
              return (
                <div key={(sec.id || sec.$id)} style={glassCard({ padding: 0, overflow: 'hidden' })}>
                  <button
                    onClick={() => toggleSection((sec.id || sec.$id))}
                    style={{
                      width: '100%',
                      padding: '16px 20px',
                      background: 'none',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)' }}>
                          {sec.title}
                        </span>
                        {(role === 'warden' || role === 'admin') && (
                          <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => handleEditRule(sec)} style={{ background: 'none', border: 'none', color: accent, cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }} title="Edit section">
                              <MdEdit style={{ fontSize: '1rem' }} />
                            </button>
                            <button onClick={() => handleDeleteRule(sec.$id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }} title="Delete section">
                              <MdDelete style={{ fontSize: '1rem' }} />
                            </button>
                          </div>
                        )}
                      </div>
                    {isExpanded ? <MdExpandLess style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }} /> : <MdExpandMore style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }} />}
                  </button>

                  {isExpanded && (
                    <div style={{ padding: '0 20px 20px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)', paddingTop: 16 }}>
                      <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {sec.rules.map((rule, idx) => (
                          <li key={idx} style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                            {rule}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          
            {(role === 'warden' || role === 'admin') && (
              <button 
                className="btn btn-outline" 
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderStyle: 'dashed' }}
                onClick={() => {
                  setEditingRuleId(null);
                  setRuleTitle('');
                  setRuleItems(['']);
                  setShowRuleModal(true);
                }}
              >
                <MdAdd /> Add New Section
              </button>
            )}

          </div>
        </div>

        {/* Emergency Contacts card */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: '0.94rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              <MdPhone style={{ color: accent }} /> Emergency Helplines
            </h3>
            {role === 'warden' && (
              <button
                className="btn btn-sm btn-primary"
                onClick={() => {
                  setEditingHelpline(null);
                  setLabel('');
                  setPhone('');
                  setEmail('');
                  setShowHelplineModal(true);
                }}
                style={{ background: accent, borderColor: accent, borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 12px', fontSize: '0.76rem' }}
              >
                <MdAdd /> Add New
              </button>
            )}
          </div>

          <div style={glassCard()}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.4 }}>
              If you require urgent assistance, medical care, or security evacuation, call the campus response numbers listed below. Always carry your resident ID card.
            </p>

            {loadingHelplines ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                Loading helplines...
              </div>
            ) : helplines.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                No helplines registered yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {helplines.map((help) => (
                  <div key={help.$id || help.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 12 }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: accentLight, color: accentDark, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                      {help.label.toLowerCase().includes('security') || help.label.toLowerCase().includes('office') ? <MdSecurity /> : <MdLocalHospital />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {help.label}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 2 }}>
                        {help.phone && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <a
                              href={`tel:${help.phone.replace(/\s+/g, '')}`}
                              style={{ fontSize: '0.82rem', color: accent, fontWeight: 800, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                              📞 {help.phone}
                            </a>
                            <button
                              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(help.phone.replace(/\s+/g, '')); toast.success('Phone number copied!'); }}
                              title="Copy phone number"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex', alignItems: 'center', borderRadius: 4, transition: 'color 0.2s' }}
                              onMouseEnter={(e) => e.currentTarget.style.color = accent}
                              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                            >
                              <MdContentCopy style={{ fontSize: '0.82rem' }} />
                            </button>
                          </div>
                        )}
                        {help.email && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <a
                              href={`mailto:${help.email}`}
                              style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            >
                              ✉️ {help.email}
                            </a>
                            <button
                              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(help.email); toast.success('Email copied!'); }}
                              title="Copy email"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex', alignItems: 'center', borderRadius: 4, transition: 'color 0.2s' }}
                              onMouseEnter={(e) => e.currentTarget.style.color = accent}
                              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                            >
                              <MdContentCopy style={{ fontSize: '0.78rem' }} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    {role === 'warden' && (
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button
                          onClick={() => handleEditHelpline(help)}
                          style={{ background: 'none', border: 'none', color: accent, cursor: 'pointer', padding: 4 }}
                          title="Edit Contact"
                        >
                          <MdEdit />
                        </button>
                        <button
                          onClick={() => handleDeleteHelpline(help.$id || help.id)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }}
                          title="Delete Contact"
                        >
                          <MdDelete />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Helpline Add/Edit Modal */}
      {showHelplineModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          backdropFilter: 'blur(4px)',
        }} onClick={() => setShowHelplineModal(false)}>
          <div style={{
            background: 'var(--surface-1)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '450px',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            position: 'relative'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                {editingHelpline ? '✏️ Edit Helpline Contact' : '📞 Add Helpline Contact'}
              </h3>
              <button 
                onClick={() => setShowHelplineModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem', display: 'flex', alignItems: 'center' }}
              >
                <MdClose />
              </button>
            </div>

            <form onSubmit={handleSaveHelpline} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>Name / Label</label>
                <input
                  type="text"
                  placeholder="e.g. Block A Warden Office"
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  className="form-control"
                  style={{ borderRadius: 8, fontSize: '0.85rem' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>Phone Number</label>
                <input
                  type="tel"
                  placeholder="e.g. +91 98765 43210"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="form-control"
                  style={{ borderRadius: 8, fontSize: '0.85rem' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. warden@college.edu"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="form-control"
                  style={{ borderRadius: 8, fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowHelplineModal(false)}
                  style={{ borderRadius: 8, padding: '8px 16px', fontSize: '0.82rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ background: accent, borderColor: accent, borderRadius: 8, padding: '8px 16px', fontSize: '0.82rem' }}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rule Add/Edit Modal */}
      {showRuleModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          backdropFilter: 'blur(4px)',
        }} onClick={() => setShowRuleModal(false)}>
          <div style={{
            background: 'var(--surface-1)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '600px',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                {editingRuleId ? '✏️ Edit Rule Section' : '📝 Add Rule Section'}
              </h3>
              <button 
                onClick={() => setShowRuleModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem', display: 'flex', alignItems: 'center' }}
              >
                <MdClose />
              </button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16, paddingRight: 4 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>Section Title</label>
                <input
                  type="text"
                  placeholder="e.g. 5. Gym & Recreation Room Timings"
                  value={ruleTitle}
                  onChange={e => setRuleTitle(e.target.value)}
                  className="form-control"
                  style={{ borderRadius: 8, fontSize: '0.85rem' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Rules List</span>
                  <button
                    type="button"
                    onClick={() => setRuleItems([...ruleItems, ''])}
                    style={{ background: 'none', border: 'none', color: accent, fontWeight: 700, cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 2 }}
                  >
                    <MdAdd /> Add Rule Item
                  </button>
                </label>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {ruleItems.map((item, index) => (
                    <div key={index} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <textarea
                        value={item}
                        onChange={e => {
                          const newItems = [...ruleItems];
                          newItems[index] = e.target.value;
                          setRuleItems(newItems);
                        }}
                        placeholder={`Rule item #${index + 1}`}
                        className="form-control"
                        rows={2}
                        style={{ flex: 1, borderRadius: 8, fontSize: '0.82rem', resize: 'vertical' }}
                      />
                      {ruleItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newItems = ruleItems.filter((_, idx) => idx !== index);
                            setRuleItems(newItems);
                          }}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center', marginTop: 6 }}
                          title="Remove item"
                        >
                          <MdDelete style={{ fontSize: '1.1rem' }} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowRuleModal(false)}
                style={{ borderRadius: 8, padding: '8px 16px', fontSize: '0.82rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveRule}
                style={{ background: accent, borderColor: accent, borderRadius: 8, padding: '8px 16px', fontSize: '0.82rem' }}
                disabled={savingRule}
              >
                {savingRule ? 'Saving...' : 'Save Section'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
