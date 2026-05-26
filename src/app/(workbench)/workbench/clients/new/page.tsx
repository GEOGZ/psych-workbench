'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { ImeInput, ImeTextarea } from '@/components/ime';

export default function NewClientPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '', contactName: '', contactEmail: '', contactPhone: '',
    crisisContactName: '', crisisContactPhone: '', notes: ''
  });
  const [error, setError] = useState('');

  const create = trpc.clients.create.useMutation({
    onSuccess: () => router.push('/workbench/clients'),
    onError: (err) => setError(err.message)
  });

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    create.mutate({
      name: form.name.trim(),
      contactName: form.contactName.trim(),
      contactEmail: form.contactEmail.trim() || undefined,
      contactPhone: form.contactPhone.trim() || undefined,
      crisisContactName: form.crisisContactName.trim(),
      crisisContactPhone: form.crisisContactPhone.trim(),
      notes: form.notes.trim() || undefined
    });
  };

  const inputStyle = {
    border: '1px solid #ddd', borderRadius: 5, padding: '0.4rem 0.6rem',
    fontSize: '0.875rem', width: '100%', boxSizing: 'border-box' as const
  };

  const Field = ({ label, field, required, type = 'text' }: { label: string; field: keyof typeof form; required?: boolean; type?: string }) => (
    <div>
      <label style={{ fontSize: '0.8rem', color: '#555', display: 'block', marginBottom: '0.2rem', fontWeight: 500 }}>
        {label}{required && ' *'}
      </label>
      <ImeInput type={type} value={form[field]} onChange={set(field)} required={required} style={inputStyle} />
    </div>
  );

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ marginBottom: '0.75rem' }}>
        <a href="/workbench/clients" style={{ fontSize: '0.8rem', color: '#888', textDecoration: 'none' }}>← 客户列表</a>
      </div>
      <h1 style={{ margin: '0 0 1.25rem', fontSize: '1.1rem', fontWeight: 700 }}>新建客户</h1>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
        <Field label="客户名称" field="name" required />
        <Field label="联系人姓名" field="contactName" required />
        <Field label="联系邮箱" field="contactEmail" type="email" />
        <Field label="联系电话" field="contactPhone" />

        <div style={{ borderTop: '1px solid #f0f0f8', paddingTop: '0.75rem' }}>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: '#c00', fontWeight: 600 }}>
            紧急联系人（必填，§4.3 安全规范）
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Field label="紧急联系人姓名" field="crisisContactName" required />
            <Field label="紧急联系电话" field="crisisContactPhone" required />
          </div>
        </div>

        <div>
          <label style={{ fontSize: '0.8rem', color: '#555', display: 'block', marginBottom: '0.2rem', fontWeight: 500 }}>备注（可选）</label>
          <ImeTextarea value={form.notes} onChange={set('notes')} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>

        {error && (
          <div style={{ fontSize: '0.8rem', color: '#c00', background: '#fff0f0', padding: '0.4rem 0.6rem', borderRadius: 4 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={create.isPending}
          style={{
            padding: '0.5rem', borderRadius: 5, border: 'none',
            background: '#4a4af0', color: '#fff', cursor: 'pointer',
            fontSize: '0.9rem', fontWeight: 600,
            opacity: create.isPending ? 0.6 : 1
          }}
        >
          {create.isPending ? '创建中…' : '创建客户'}
        </button>
      </form>
    </div>
  );
}
