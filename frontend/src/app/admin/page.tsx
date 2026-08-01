"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface User {
  id: string;
  email: string;
  subscription_status: string;
  trial_ends_at: string;
}

export default function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [masterKey, setMasterKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchAdminData(session.access_token);
      else setLoading(false);
    });
  }, []);

  const fetchAdminData = async (token: string) => {
    try {
      const [usersRes, settingsRes] = await Promise.all([
        fetch('https://context-engine-production-51a1.up.railway.app/api/admin/users', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('https://context-engine-production-51a1.up.railway.app/api/admin/settings', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      
      if (usersRes.ok) {
        setUsers(await usersRes.json());
      }
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setMasterKey(data.openai_api_key || '');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const updateMasterKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    try {
      const res = await fetch('https://context-engine-production-51a1.up.railway.app/api/admin/settings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ openai_api_key: masterKey })
      });
      if (res.ok) alert('Master API Key updated successfully');
      else alert('Failed to update API key. Are you sure you are the master admin?');
    } catch (e) {
      console.error(e);
    }
  };

  if (!session) return <div style={{ color: 'white', padding: '20px' }}>Please log in to access the Admin Dashboard.</div>;
  if (session.user.email !== 'ronimationstudios@gmail.com') return <div style={{ color: 'white', padding: '20px' }}>Unauthorized. Only ronimationstudios@gmail.com can access this page.</div>;

  return (
    <div className="admin-container">
      <h1 className="admin-title gradient-text">Admin Dashboard</h1>
      
      <div className="admin-section glass-panel">
        <h2 style={{ color: 'white' }}>Global Settings</h2>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '15px' }}>This OpenAI API Key will be used securely across the entire Corpus platform. Your users will never see it.</p>
        <form onSubmit={updateMasterKey} className="admin-form" style={{ display: 'flex', gap: '10px' }}>
          <input 
            type="password" 
            className="glass-input"
            value={masterKey}
            onChange={(e) => setMasterKey(e.target.value)}
            placeholder="sk-proj-..."
            style={{ maxWidth: '400px' }}
          />
          <button type="submit" className="glass-btn primary">Save Settings</button>
        </form>
      </div>

      <div className="admin-section glass-panel" style={{ marginTop: '20px' }}>
        <h2 style={{ color: 'white' }}>User Management</h2>
        {loading ? <p style={{ color: 'white' }}>Loading users...</p> : (
          <table className="admin-table" style={{ color: 'white' }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Status</th>
                <th>Trial Ends At</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{u.id}</td>
                  <td>
                    <span className={`badge ${u.subscription_status === 'active' ? 'badge-caption' : 'badge-knowledge'}`}>
                      {u.subscription_status}
                    </span>
                  </td>
                  <td>{u.trial_ends_at ? new Date(u.trial_ends_at).toLocaleString() : 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
