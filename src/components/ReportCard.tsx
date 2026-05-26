'use client';

import { useState, useRef } from 'react';
import { trpc } from '@/lib/trpc';

const FILE_TYPE_LABEL: Record<string, string> = { pdf: 'PDF', word: 'Word', other: '其他' };
const OSS_BUCKET_BASE = process.env.NEXT_PUBLIC_OSS_PUBLIC_URL ?? '';

interface ReportCardProps {
  projectId: string;
}

export function ReportCard({ projectId }: ReportCardProps) {
  const { data: reports = [], refetch } = trpc.reports.listByProject.useQuery({ projectId });
  const getUploadUrl = trpc.reports.getUploadUrl.useMutation();
  const confirmUpload = trpc.reports.confirmUpload.useMutation({ onSuccess: () => refetch() });
  const deleteReport = trpc.reports.delete.useMutation({ onSuccess: () => refetch() });
  const toggleVisibility = trpc.reports.togglePortalVisibility.useMutation({ onSuccess: () => refetch() });

  const [title, setTitle] = useState('');
  const [fileType, setFileType] = useState<'pdf' | 'word' | 'other'>('pdf');
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const panelStyle: React.CSSProperties = {
    background: '#fff', borderRadius: 8, padding: '1.25rem',
    boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '1rem',
  };
  const inputStyle: React.CSSProperties = {
    border: '1px solid #ddd', borderRadius: 5, padding: '0.35rem 0.55rem',
    fontSize: '0.85rem', boxSizing: 'border-box',
  };

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file || !title.trim()) return;
    setUploadErr('');
    setUploading(true);
    try {
      const { uploadUrl, fileKey } = await getUploadUrl.mutateAsync({
        projectId, fileType, fileName: file.name,
      });
      await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      const fileUrl = OSS_BUCKET_BASE
        ? `${OSS_BUCKET_BASE}/${fileKey}`
        : uploadUrl.split('?')[0] ?? uploadUrl;
      await confirmUpload.mutateAsync({
        projectId, title: title.trim(), fileType, fileKey, fileUrl,
        fileSize: file.size, visibleToPortal: true,
      });
      setTitle('');
      setFileType('pdf');
      if (fileRef.current) fileRef.current.value = '';
    } catch (err: any) {
      setUploadErr(err.message ?? '上传失败');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={panelStyle}>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        项目报告
      </p>

      {/* Upload form */}
      <form onSubmit={handleUpload} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div style={{ flex: '1 1 180px' }}>
          <label style={{ fontSize: '0.75rem', color: '#555', display: 'block', marginBottom: '0.2rem' }}>报告标题 *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} required placeholder="如：综合素质测评报告" style={{ ...inputStyle, width: '100%' }} />
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: '#555', display: 'block', marginBottom: '0.2rem' }}>类型</label>
          <select value={fileType} onChange={e => setFileType(e.target.value as typeof fileType)} style={inputStyle}>
            <option value="pdf">PDF</option>
            <option value="word">Word</option>
            <option value="other">其他</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: '#555', display: 'block', marginBottom: '0.2rem' }}>文件 *</label>
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" required style={{ fontSize: '0.8rem' }} />
        </div>
        <button type="submit" disabled={uploading} style={{ padding: '0.35rem 0.85rem', borderRadius: 5, border: 'none', background: '#4a4af0', color: '#fff', cursor: uploading ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 600, opacity: uploading ? 0.6 : 1, whiteSpace: 'nowrap' }}>
          {uploading ? '上传中…' : '上传报告'}
        </button>
      </form>
      {uploadErr && <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: '#c00' }}>{uploadErr}</p>}

      {/* Report list */}
      {reports.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#aaa' }}>暂无上传报告。</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {reports.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: '#f8f8fc', borderRadius: 6, padding: '0.5rem 0.75rem', fontSize: '0.82rem' }}>
              <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: 10, background: '#e8e8fd', color: '#4a4af0', fontWeight: 600 }}>
                {FILE_TYPE_LABEL[r.fileType] ?? r.fileType}
              </span>
              <span style={{ flex: 1, fontWeight: 500, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
              <span style={{ color: '#aaa', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                {new Date(r.uploadedAt).toLocaleDateString('zh-CN')}
              </span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', fontSize: '0.75rem', color: '#555', whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={r.visibleToPortal} onChange={e => toggleVisibility.mutate({ reportId: r.id, visible: e.target.checked })} style={{ accentColor: '#4a4af0' }} />
                门户可见
              </label>
              <a href={r.downloadUrl} target="_blank" rel="noopener noreferrer"
                style={{ padding: '0.2rem 0.5rem', borderRadius: 4, border: '1px solid #c7c7f0', color: '#4a4af0', textDecoration: 'none', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                下载
              </a>
              <button onClick={() => deleteReport.mutate({ reportId: r.id })} disabled={deleteReport.isPending}
                style={{ padding: '0.2rem 0.5rem', borderRadius: 4, border: '1px solid #fca5a5', background: '#fff', color: '#c00', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                删除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
