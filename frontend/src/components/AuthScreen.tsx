"use client";
import React, { useState } from 'react';
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from '../lib/supabaseClient'

export default function AuthScreen({ onLogin }: { onLogin: () => void }) {
  // We use Supabase's native Auth UI instead of a custom form
  // to ensure secure login and signup flows, but wrap it in our Glassmorphism UI
  return (
    <div className="auth-container">
      {/* Animated background particles */}
      <div className="bg-particles"></div>
      
      <div className="auth-content">
        <div className="auth-card glass-panel">
          <h2 className="auth-title gradient-text" style={{ textAlign: 'center', marginBottom: '10px' }}>Context Engine PRO</h2>
          <p style={{ textAlign: 'center', color: '#94a3b8', marginBottom: '30px', fontSize: '0.9rem' }}>Log in or sign up to access your church's database.</p>
          
          <div style={{ backgroundColor: 'transparent' }}>
            <Auth
              supabaseClient={supabase}
              appearance={{ 
                theme: ThemeSupa,
                variables: {
                  default: {
                    colors: {
                      brand: '#3b82f6',
                      brandAccent: '#8b5cf6',
                    }
                  }
                }
              }}
              theme="dark"
              providers={[]}
            />
          </div>
        </div>

        <div className="auth-info glass-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3 className="gradient-text">About the Product</h3>
          <p style={{ lineHeight: 1.6, marginTop: '10px' }}>
            AI Context Engine is a powerful live broadcast companion. It listens to your audio,
            generates live transcriptions, and automatically stages scriptures, knowledge bites,
            and captions using advanced NLP. Push them live directly to your broadcast output.
          </p>
          <div className="contact-info" style={{ marginTop: '30px' }}>
            <h4 style={{ color: '#fff' }}>Contact Support</h4>
            <p style={{ margin: '10px 0', color: '#cbd5e1' }}>📧 Email: ronimationstudios@gmail.com</p>
            <p style={{ margin: '10px 0', color: '#cbd5e1' }}>💬 WhatsApp: +234 123 456 7890</p>
          </div>
        </div>
      </div>
    </div>
  );
}
