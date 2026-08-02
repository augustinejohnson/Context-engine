"use client";
import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function AuthScreen({ onLogin, onClose }: { onLogin: () => void, onClose: () => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [churchName, setChurchName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // The page.tsx auth listener will automatically handle the successful login
      } else {
        if (!churchName.trim()) {
          throw new Error("Organization / Church Name is required.");
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { church_name: churchName }
          }
        });
        if (error) throw error;
        setSuccessMsg("Registration successful! Please check your email inbox (and spam folder) to confirm your account before logging in.");
        setIsLogin(true);
      }
    } catch (err: any) {
      console.error("Auth Error:", err);
      let msg = err.message || JSON.stringify(err);
      if (msg === "{}" || msg === "[object Object]") {
        msg = "Registration failed. If you just configured Custom SMTP, please verify your sender email is verified in Resend and your API key is correct.";
      }
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: '24px'
    }}>
      <div 
        className="glass-panel" 
        style={{ 
          maxWidth: '450px', width: '100%', padding: '40px', position: 'relative',
          background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)'
        }}
      >
        <button 
          onClick={onClose}
          style={{
            position: 'absolute', top: '16px', right: '16px',
            background: 'none', border: 'none', color: '#a1a1aa', fontSize: '1.5rem', cursor: 'pointer'
          }}
        >
          ✕
        </button>
        
        <h2 className="gradient-text" style={{ textAlign: 'center', marginBottom: '10px', fontSize: '1.5rem', fontWeight: 'bold' }}>Corpus</h2>
        <p style={{ textAlign: 'center', color: '#94a3b8', marginBottom: '30px', fontSize: '0.9rem' }}>
          {isLogin ? "Log in to manage your broadcasts." : "Register your organization to get started."}
        </p>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {!isLogin && (
            <div>
              <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '6px' }}>Organization / Church Name</label>
              <input 
                type="text"
                required
                className="glass-input"
                style={{ width: '100%', padding: '10px 15px', color: '#fff', background: 'rgba(0,0,0,0.3)' }}
                value={churchName}
                onChange={e => setChurchName(e.target.value)}
                placeholder="e.g. Grace Fellowship"
              />
            </div>
          )}
          
          <div>
            <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '6px' }}>Email Address</label>
            <input 
              type="email"
              required
              className="glass-input"
              style={{ width: '100%', padding: '10px 15px', color: '#fff', background: 'rgba(0,0,0,0.3)' }}
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '6px' }}>Password</label>
            <input 
              type="password"
              required
              className="glass-input"
              style={{ width: '100%', padding: '10px 15px', color: '#fff', background: 'rgba(0,0,0,0.3)' }}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {errorMsg && (
            <div style={{ color: '#ef4444', fontSize: '0.85rem', background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              {errorMsg}
            </div>
          )}
          
          {successMsg && (
            <div style={{ color: '#22c55e', fontSize: '0.85rem', background: 'rgba(34, 197, 94, 0.1)', padding: '10px', borderRadius: '4px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
              {successMsg}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            style={{
              width: '100%', padding: '12px', marginTop: '10px',
              background: loading ? 'rgba(56, 189, 248, 0.5)' : '#38bdf8', 
              color: '#fff', border: 'none', borderRadius: '6px',
              fontSize: '1rem', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? "Processing..." : (isLogin ? "Sign In" : "Sign Up")}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button 
            type="button" 
            onClick={() => { setIsLogin(!isLogin); setErrorMsg(''); setSuccessMsg(''); }}
            style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: '0.9rem', textDecoration: 'underline' }}
          >
            {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
          </button>
        </div>
      </div>
    </div>
  );
}
