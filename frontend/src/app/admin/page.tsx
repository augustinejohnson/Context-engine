"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';

const SearchableDropdown = ({ value, onChange, options, placeholder }: { value: string, onChange: (val: string) => void, options: {label: string, value: string}[], placeholder: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  
  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(search.toLowerCase()) || 
    opt.value.toLowerCase().includes(search.toLowerCase())
  );

  const selectedLabel = options.find(o => o.value === value)?.label || value;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        className="glass-input"
        style={{ width: '100%', padding: '10px 15px', color: '#000', background: 'rgba(255,255,255,0.9)', cursor: 'text' }}
        placeholder={placeholder}
        value={isOpen ? search : selectedLabel}
        onChange={(e) => {
          setSearch(e.target.value);
          setIsOpen(true);
          onChange(e.target.value); // Allow custom models if typed
        }}
        onFocus={() => {
          setSearch('');
          setIsOpen(true);
        }}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
      />
      <div 
        style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#000', fontSize: '12px' }}
      >
        ▼
      </div>
      {isOpen && (
        <div style={{ 
          position: 'absolute', top: '100%', left: 0, right: 0, 
          background: '#fff', border: '1px solid #ccc', borderRadius: '4px',
          maxHeight: '300px', overflowY: 'auto', zIndex: 100,
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          {filteredOptions.length > 0 ? filteredOptions.map(opt => (
            <div 
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setSearch('');
                setIsOpen(false);
              }}
              style={{ padding: '10px 12px', color: '#000', cursor: 'pointer', borderBottom: '1px solid #eee' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              {opt.label}
            </div>
          )) : (
            <div style={{ padding: '10px 12px', color: '#64748b' }}>No models found...</div>
          )}
        </div>
      )}
    </div>
  );
};

interface User {
  id: string;
  email: string;
  subscription_status: string;
  trial_ends_at: string | null;
  church_name?: string;
}

export default function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [masterKey, setMasterKey] = useState('');
  const [aiProvider, setAiProvider] = useState('openai');
  const [aiModel, setAiModel] = useState('gpt-4o-mini');
  const [openRouterModels, setOpenRouterModels] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState({ totalUsers: 0, activeConnections: 0 });

  useEffect(() => {
    // Fetch OpenRouter models dynamically
    fetch('https://openrouter.ai/api/v1/models')
      .then(res => res.json())
      .then(data => {
        if (data && data.data) {
          setOpenRouterModels(data.data);
        }
      })
      .catch(err => console.error("Failed to fetch OpenRouter models:", err));
  }, []);
  const [newPassword, setNewPassword] = useState('');
  
  const [showApiKey, setShowApiKey] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editTrialDate, setEditTrialDate] = useState('');

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
      const [usersRes, settingsRes, analyticsRes] = await Promise.all([
        fetch('https://context-engine-production-51a1.up.railway.app/api/admin/users', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('https://context-engine-production-51a1.up.railway.app/api/admin/settings', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('https://context-engine-production-51a1.up.railway.app/api/admin/analytics', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      
      if (usersRes.ok) {
        setUsers(await usersRes.json());
      }
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setMasterKey(data.api_key || data.openai_api_key || '');
        setAiProvider(data.ai_provider || 'openai');
        setAiModel(data.ai_model || getDefaultModel(data.ai_provider || 'openai'));
      }
      if (analyticsRes.ok) {
        setAnalytics(await analyticsRes.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getDefaultModel = (provider: string) => {
    if (provider === 'gemini') return 'gemini-2.5-flash';
    if (provider === 'claude') return 'claude-3-5-sonnet-20240620';
    if (provider === 'openrouter') return 'openai/gpt-4o-mini';
    return 'gpt-4o-mini';
  };

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const provider = e.target.value;
    setAiProvider(provider);
    setAiModel(getDefaultModel(provider));
  };

  const updateGlobalSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    try {
      const res = await fetch('https://context-engine-production-51a1.up.railway.app/api/admin/settings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ ai_provider: aiProvider, ai_model: aiModel, api_key: masterKey })
      });
      if (res.ok) alert('Global Settings updated successfully!');
      else alert('Failed to update settings. Are you the master admin?');
    } catch (e) {
      console.error(e);
    }
  };

  const updateAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) return;
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) alert(error.message);
    else {
      alert("Password updated successfully!");
      setNewPassword('');
    }
  };

  const saveUserEdit = async () => {
    if (!editingUser || !session) return;
    try {
      const res = await fetch('https://context-engine-production-51a1.up.railway.app/api/admin/update_user', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          userId: editingUser.id, 
          subscription_status: editStatus, 
          trial_ends_at: editTrialDate 
        })
      });
      if (res.ok) {
        alert('User updated successfully!');
        setEditingUser(null);
        fetchAdminData(session.access_token);
      } else {
        alert('Failed to update user.');
      }
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
    <div style={{ minHeight: '100vh', backgroundColor: '#09090b', color: '#f8fafc', fontFamily: "'Inter', sans-serif" }}>
      {/* Navigation */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', padding: '20px 40px', borderBottom: '1px solid rgba(255,255,255,0.05)', backgroundColor: '#16161a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
          <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }} className="gradient-text">Corpus Admin</h1>
          <Link href="/" style={{ color: '#a1a1aa', textDecoration: 'none' }}>Go to Dashboard</Link>
        </div>
        <button 
          onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }}
          className="glass-btn" style={{ padding: '8px 16px', fontSize: '14px' }}>
          Sign Out
        </button>
      </nav>

      <div className="admin-container" style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '40px' }}>
        
        {/* Top Row: Analytics */}
        <div style={{ display: 'flex', gap: '20px' }}>
          <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px' }}>
            <h3 style={{ color: '#94a3b8', margin: '0 0 10px 0', fontSize: '1.1rem', fontWeight: 500 }}>Total Registered Users</h3>
            <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#38bdf8', textShadow: '0 0 20px rgba(56, 189, 248, 0.4)' }}>
              {analytics.totalUsers}
            </div>
          </div>
          
          <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px' }}>
            <h3 style={{ color: '#94a3b8', margin: '0 0 10px 0', fontSize: '1.1rem', fontWeight: 500 }}>Active Live Connections (Sockets)</h3>
            <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#10b981', textShadow: '0 0 20px rgba(16, 185, 129, 0.4)' }}>
              {analytics.activeConnections}
            </div>
            <p style={{ margin: '10px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>Updates on page load</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '40px' }}>
          {/* Left Column: Settings & Security */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '30px' }}>
          
          <div className="admin-section glass-panel">
            <h2 style={{ color: 'white', marginBottom: '15px' }}>Global AI Settings</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '20px' }}>Select the AI provider and model. This will be used globally for translations and knowledge extraction.</p>
            <form onSubmit={updateGlobalSettings} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '14px', marginBottom: '8px' }}>AI Provider</label>
                <select className="glass-input" value={aiProvider} onChange={handleProviderChange} style={{ cursor: 'pointer' }}>
                  <option style={{ color: '#000' }} value="openai">OpenAI</option>
                  <option style={{ color: '#000' }} value="gemini">Google Gemini</option>
                  <option style={{ color: '#000' }} value="claude">Anthropic Claude</option>
                  <option style={{ color: '#000' }} value="openrouter">OpenRouter</option>
                </select>
              </div>
              
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '14px', marginBottom: '8px' }}>AI Model (Search or select)</label>
                <SearchableDropdown
                  value={aiModel}
                  onChange={setAiModel}
                  placeholder="Search or enter a custom model..."
                  options={
                    aiProvider === 'openai' ? [
                      { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast)' },
                      { value: 'gpt-4o', label: 'GPT-4o (Powerful)' },
                      { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' }
                    ] : aiProvider === 'gemini' ? [
                      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
                      { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
                      { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' }
                    ] : aiProvider === 'claude' ? [
                      { value: 'claude-3-5-sonnet-20240620', label: 'Claude 3.5 Sonnet' },
                      { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
                      { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' }
                    ] : openRouterModels.map(m => ({ value: m.id, label: m.name }))
                  }
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '14px', marginBottom: '8px' }}>API Key</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showApiKey ? "text" : "password"}
                    className="glass-input"
                    value={masterKey}
                    onChange={(e) => setMasterKey(e.target.value)}
                    placeholder="Paste your API key here..."
                    style={{ paddingRight: '40px' }}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowApiKey(!showApiKey)}
                    style={{ 
                      position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer'
                    }}
                  >
                    {showApiKey ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>
              <button type="submit" className="glass-btn primary" style={{ marginTop: '10px' }}>Save AI Settings</button>
            </form>
          </div>

          <div className="admin-section glass-panel">
            <h2 style={{ color: 'white', marginBottom: '15px' }}>Admin Security</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '20px' }}>Update your master admin password.</p>
            <form onSubmit={updateAdminPassword} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '14px', marginBottom: '8px' }}>New Password</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showAdminPassword ? "text" : "password"}
                    className="glass-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    required
                    minLength={6}
                    style={{ paddingRight: '40px' }}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    style={{ 
                      position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer'
                    }}
                  >
                    {showAdminPassword ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>
              <button type="submit" className="glass-btn" style={{ marginTop: '10px' }}>Change Password</button>
            </form>
          </div>

        </div>

        {/* Right Column: User Management */}
        <div style={{ flex: 2 }}>
          <div className="admin-section glass-panel" style={{ height: '100%' }}>
            <h2 style={{ color: 'white', marginBottom: '20px' }}>User Management</h2>
            {loading ? <p style={{ color: '#94a3b8' }}>Loading users...</p> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <th style={{ padding: '12px', color: '#94a3b8', fontWeight: 500 }}>Email</th>
                      <th style={{ padding: '12px', color: '#94a3b8', fontWeight: 500 }}>Organization</th>
                      <th style={{ padding: '12px', color: '#94a3b8', fontWeight: 500 }}>Status</th>
                      <th style={{ padding: '12px', color: '#94a3b8', fontWeight: 500 }}>Trial Ends</th>
                      <th style={{ padding: '12px', color: '#94a3b8', fontWeight: 500 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '12px', fontSize: '0.9rem' }}>{u.email || u.id}</td>
                        <td style={{ padding: '12px', fontSize: '0.9rem', color: '#cbd5e1' }}>{u.church_name || <span style={{ color: '#64748b', fontStyle: 'italic' }}>None</span>}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ 
                            padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600,
                            background: u.subscription_status === 'active' || u.subscription_status === 'lifetime' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: u.subscription_status === 'active' || u.subscription_status === 'lifetime' ? '#10b981' : '#ef4444'
                          }}>
                            {u.subscription_status.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '12px', fontSize: '0.9rem', color: '#94a3b8' }}>
                          {u.trial_ends_at ? new Date(u.trial_ends_at).toLocaleDateString() : 'N/A'}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <button 
                            className="glass-btn" 
                            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                            onClick={() => {
                              setEditingUser(u);
                              setEditStatus(u.subscription_status);
                              setEditTrialDate(u.trial_ends_at ? new Date(u.trial_ends_at).toISOString().slice(0, 16) : '');
                            }}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-panel" style={{ width: '400px', padding: '30px' }}>
            <h3 style={{ marginTop: 0, color: 'white', marginBottom: '20px' }}>Edit User</h3>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '14px', marginBottom: '8px' }}>Status</label>
              <select className="glass-input" value={editStatus} onChange={e => setEditStatus(e.target.value)}>
                <option style={{ color: '#000' }} value="inactive">Inactive</option>
                <option style={{ color: '#000' }} value="trial">Trial</option>
                <option style={{ color: '#000' }} value="active">Active (Pro)</option>
                <option style={{ color: '#000' }} value="lifetime">Lifetime</option>
              </select>
            </div>

            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '14px', marginBottom: '8px' }}>Trial Ends At</label>
              <input 
                type="datetime-local" 
                className="glass-input"
                value={editTrialDate}
                onChange={e => setEditTrialDate(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="glass-btn primary" style={{ flex: 1 }} onClick={saveUserEdit}>Save Changes</button>
              <button className="glass-btn" style={{ flex: 1 }} onClick={() => setEditingUser(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
