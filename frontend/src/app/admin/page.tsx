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

  if (!session) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#09090b', display: 'flex', flexDirection: 'column' }}>
        <div style={{ color: 'white', padding: '20px', textAlign: 'center' }}>Please log in with the Master Admin account to access the Admin Dashboard.</div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel" style={{ width: '400px', maxWidth: '90vw', padding: '30px', position: 'relative' }}>
            <h2 className="auth-title gradient-text" style={{ textAlign: 'center', marginBottom: '20px' }}>Admin Login</h2>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const email = (form.elements.namedItem('email') as HTMLInputElement).value;
              const password = (form.elements.namedItem('password') as HTMLInputElement).value;
              const { error } = await supabase.auth.signInWithPassword({ email, password });
              if (error) alert(error.message);
              else window.location.reload();
            }} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '14px', marginBottom: '8px' }}>Admin Email</label>
                <input name="email" type="email" required className="glass-input" defaultValue="ronimationstudios@gmail.com" />
              </div>
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '14px', marginBottom: '8px' }}>Password</label>
                <input name="password" type="password" required className="glass-input" />
              </div>
              <button type="submit" className="glass-btn primary" style={{ width: '100%', marginTop: '10px' }}>Log In</button>
            </form>
          </div>
        </div>
      </div>
    );
  }
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
