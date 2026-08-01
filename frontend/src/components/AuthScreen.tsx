import React from 'react'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from '../lib/supabaseClient'

export default function AuthScreen() {
  return (
    <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '40px', backgroundColor: '#1e293b', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
        <h2 style={{ textAlign: 'center', color: '#fff', marginBottom: '10px' }}>Context Engine SaaS</h2>
        <p style={{ textAlign: 'center', color: '#94a3b8', marginBottom: '30px', fontSize: '0.9rem' }}>Log in or sign up to access your church's database.</p>
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          theme="dark"
          providers={[]}
        />
      </div>
    </div>
  )
}
