import React, { useEffect, useState, useRef, useCallback } from 'react';
import Navbar from '../components/Navbar.jsx';
import { getProjects, getPlans, uploadPlans, deletePlan, downloadPlanUrl } from '../api.js';

function fmtSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function Plans() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [plans, setPlans] = useState([]);
  const [revision, setRevision] = useState('');
  const [label, setLabel] = useState('');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [pdfPreview, setPdfPreview] = useState(null);
  const fileRef = useRef();

  useEffect(() => {
    getProjects().then((r) => {
      setProjects(r.data);
      if (r.data.length > 0) setSelectedProject(String(r.data[0].id));
    });
  }, []);

  const loadPlans = useCallback(() => {
    if (!selectedProject) return;
    getPlans(selectedProject).then((r) => setPlans(r.data));
  }, [selectedProject]);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  const handleFiles = async (files) => {
    if (!selectedProject) return alert('Select a project first.');
    const allowed = ['.pdf', '.dwg', '.dxf'];
    const filtered = Array.from(files).filter((f) => allowed.some((ext) => f.name.toLowerCase().endsWith(ext)));
    if (filtered.length === 0) return setUploadError('Only PDF, DWG, and DXF files are accepted.');
    setUploadError('');
    setUploading(true);
    const fd = new FormData();
    filtered.forEach((f) => fd.append('files', f));
    fd.append('project_id', selectedProject);
    fd.append('revision', revision);
    fd.append('label', label);
    try {
      await uploadPlans(fd);
      setRevision('');
      setLabel('');
      loadPlans();
    } catch (err) {
      setUploadError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this file?')) return;
    await deletePlan(id);
    loadPlans();
  };

  const dropZone = {
    border: `2px dashed ${dragging ? '#f97316' : '#d1d5db'}`,
    borderRadius: 12,
    padding: 40,
    textAlign: 'center',
    background: dragging ? '#fff7ed' : '#fafafa',
    cursor: 'pointer',
    transition: 'all 0.15s',
    marginBottom: 24,
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Navbar />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', marginBottom: 24 }}>Plans</h1>

        {/* Project Selector */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 13, color: '#64748b', fontWeight: 500, display: 'block', marginBottom: 6 }}>Project</label>
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            style={{ padding: '9px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, minWidth: 280 }}
          >
            <option value="">— Select a project —</option>
            {projects.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
          </select>
        </div>

        {selectedProject && (
          <>
            {/* Upload Fields */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: 4 }}>Revision</label>
                <input
                  value={revision}
                  onChange={(e) => setRevision(e.target.value)}
                  placeholder="e.g. Rev 2"
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 14 }}
                />
              </div>
              <div style={{ flex: 2 }}>
                <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: 4 }}>Label / Description</label>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Floor Plan, Electrical Layout..."
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 14 }}
                />
              </div>
            </div>

            {/* Drop Zone */}
            <div
              style={dropZone}
              onClick={() => fileRef.current.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
            >
              <div style={{ fontSize: 36, marginBottom: 8 }}>📁</div>
              <div style={{ fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                {uploading ? 'Uploading...' : 'Drop files here or click to browse'}
              </div>
              <div style={{ fontSize: 13, color: '#94a3b8' }}>PDF, DWG, DXF — up to 50MB each</div>
              <input ref={fileRef} type="file" multiple accept=".pdf,.dwg,.dxf" style={{ display: 'none' }}
                onChange={(e) => handleFiles(e.target.files)} />
            </div>

            {uploadError && (
              <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 16 }}>{uploadError}</div>
            )}

            {/* Plans Table */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {['Name', 'Type', 'Size', 'Revision', 'Label', 'Uploaded', 'Actions'].map((h) => (
                      <th key={h} style={{ padding: '11px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 13 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {plans.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No files uploaded yet.</td></tr>
                  )}
                  {plans.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '11px 14px', color: '#0f172a', fontWeight: 500 }}>{p.original_name}</td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{
                          background: p.file_type === 'pdf' ? '#eff6ff' : '#f0fdf4',
                          color: p.file_type === 'pdf' ? '#2563eb' : '#16a34a',
                          borderRadius: 99, padding: '2px 9px', fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
                        }}>{p.file_type || '?'}</span>
                      </td>
                      <td style={{ padding: '11px 14px', color: '#64748b' }}>{fmtSize(p.file_size)}</td>
                      <td style={{ padding: '11px 14px', color: '#374151' }}>{p.revision || '—'}</td>
                      <td style={{ padding: '11px 14px', color: '#374151' }}>{p.label || '—'}</td>
                      <td style={{ padding: '11px 14px', color: '#64748b', fontSize: 12 }}>
                        {new Date(p.uploaded_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {p.file_type === 'pdf' && (
                            <button
                              onClick={() => setPdfPreview(`/uploads/${p.filename}`)}
                              style={{ background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}
                            >Preview</button>
                          )}
                          <a
                            href={downloadPlanUrl(p.id)}
                            download
                            style={{ background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, textDecoration: 'none', display: 'inline-block' }}
                          >Download</a>
                          <button
                            onClick={() => handleDelete(p.id)}
                            style={{ background: '#fff1f2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}
                          >Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* PDF Preview Modal */}
      {pdfPreview && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setPdfPreview(null)}
        >
          <div style={{ background: '#fff', borderRadius: 10, overflow: 'hidden', width: '85vw', height: '85vh', boxShadow: '0 30px 80px rgba(0,0,0,0.5)' }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ background: '#0f172a', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#f97316', fontWeight: 700 }}>PDF Preview</span>
              <button onClick={() => setPdfPreview(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>
            <iframe src={pdfPreview} style={{ width: '100%', height: 'calc(100% - 44px)', border: 'none' }} title="PDF Preview" />
          </div>
        </div>
      )}
    </div>
  );
}
