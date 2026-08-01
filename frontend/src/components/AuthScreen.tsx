"use client";
import React from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../lib/supabaseClient';

export default function AuthScreen({ onLogin, onClose }: { onLogin: () => void, onClose: () => void }) {
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
        
        <h2 className="gradient-text" style={{ textAlign: 'center', marginBottom: '10px', fontSize: '1.8rem' }}>Context Engine PRO</h2>
        <p style={{ textAlign: 'center', color: '#94a3b8', marginBottom: '30px', fontSize: '0.9rem' }}>
          Enter your dashboard to manage live broadcasts.
        </p>
        
        <div style={{ backgroundColor: 'transparent' }}>
          <Auth
            supabaseClient={supabase}
            appearance={{ 
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#38bdf8',
                    brandAccent: '#818cf8',
                    defaultButtonBackground: 'rgba(255,255,255,0.05)',
                    defaultButtonBackgroundHover: 'rgba(255,255,255,0.1)',
                    defaultButtonBorder: 'rgba(255,255,255,0.1)',
                    inputBackground: 'rgba(0,0,0,0.3)',
                    inputBorder: 'rgba(255,255,255,0.1)',
                    inputBorderHover: 'rgba(255,255,255,0.3)',
                    inputBorderFocus: '#38bdf8',
                  }
                }
              }
            }}
            theme="dark"
            providers={[]}
          />
        </div>
      </div>
    </div>
  );
}
