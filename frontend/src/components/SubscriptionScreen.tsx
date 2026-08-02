"use client";
import React, { useState } from 'react';
import { usePaystackPayment } from 'react-paystack';
import { supabase } from '../lib/supabaseClient';

export default function SubscriptionScreen({ email, onSubscribeSuccess, trialEndsAt }: { email: string, onSubscribeSuccess: () => void, trialEndsAt?: string }) {
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');

  const config = {
    reference: (new Date()).getTime().toString(),
    email: email,
    amount: selectedPlan === 'monthly' ? 10 * 100 : 100 * 100, // Paystack amount is in cents for USD ($10 and $100)
    currency: 'USD',
    publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || 'pk_test_67ecf7f3d86d4b4d262edb6ad4bb8a4f48c9ea6c',
  };

  const initializePayment = usePaystackPayment(config);

  const onSuccess = async (reference: any) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`https://context-engine-production-51a1.up.railway.app/api/verify_payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ reference: reference.reference })
      });
      if (res.ok) {
        onSubscribeSuccess();
      } else {
        alert("Payment verified but failed to activate subscription on server.");
      }
    } catch (e) {
      console.error(e);
      alert("Error verifying payment.");
    } finally {
      setLoading(false);
    }
  };

  const onClose = () => {
    console.log('Payment closed');
  };

  const hasTrial = trialEndsAt && new Date(trialEndsAt) > new Date();

  return (
    <div className="auth-container">
      <div className="bg-particles"></div>
      
      <div style={{ position: 'absolute', top: '20px', right: '30px', zIndex: 20 }}>
        <button 
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.reload();
          }}
          className="glass-btn"
          style={{ fontSize: '14px', padding: '8px 16px' }}
        >
          Sign Out
        </button>
      </div>

      <div className="subscription-card glass-panel" style={{ maxWidth: '800px', width: '100%', position: 'relative', zIndex: 10 }}>
        <h2 className="auth-title gradient-text" style={{ textAlign: 'center', marginBottom: '10px' }}>Choose Your Plan</h2>
        <p style={{ textAlign: 'center', color: '#94a3b8', marginBottom: '30px' }}>
          {hasTrial 
            ? `You have a free trial active until ${new Date(trialEndsAt).toLocaleDateString()}! Upgrade early to secure your price.` 
            : `Your trial has expired. Upgrade to continue using Corpus.`}
        </p>
        
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          {/* Monthly Plan */}
          <div 
            className="plan-tier glass-panel" 
            style={{ 
              flex: '1 1 300px', 
              padding: '20px', 
              background: selectedPlan === 'monthly' ? 'rgba(56, 189, 248, 0.1)' : 'rgba(255,255,255,0.02)',
              border: selectedPlan === 'monthly' ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
              cursor: 'pointer',
              transition: 'all 0.3s'
            }}
            onClick={() => setSelectedPlan('monthly')}
          >
            <h3 style={{ margin: 0, color: '#fff' }}>Pro Monthly</h3>
            <p className="gradient-text" style={{ fontSize: '32px', fontWeight: 'bold', margin: '10px 0' }}>$10<span style={{ fontSize: '16px', color: '#94a3b8' }}>/mo</span></p>
            <ul style={{ color: '#cbd5e1', paddingLeft: '20px', lineHeight: 1.6, marginBottom: '20px' }}>
              <li>Unlimited Live Transcripts & Translations</li>
              <li>AI Smart Scripture & Lyrics Staging</li>
              <li>Premium Lower Thirds & Overlays</li>
            </ul>
          </div>

          {/* Yearly Plan */}
          <div 
            className="plan-tier glass-panel" 
            style={{ 
              flex: '1 1 300px', 
              padding: '20px', 
              background: selectedPlan === 'yearly' ? 'rgba(56, 189, 248, 0.1)' : 'rgba(255,255,255,0.02)',
              border: selectedPlan === 'yearly' ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
              cursor: 'pointer',
              transition: 'all 0.3s'
            }}
            onClick={() => setSelectedPlan('yearly')}
          >
            <div style={{ background: '#38bdf8', color: '#000', fontSize: '12px', fontWeight: 'bold', padding: '4px 8px', borderRadius: '12px', display: 'inline-block', marginBottom: '8px' }}>SAVE $20</div>
            <h3 style={{ margin: 0, color: '#fff' }}>Pro Yearly</h3>
            <p className="gradient-text" style={{ fontSize: '32px', fontWeight: 'bold', margin: '10px 0' }}>$100<span style={{ fontSize: '16px', color: '#94a3b8' }}>/yr</span></p>
            <ul style={{ color: '#cbd5e1', paddingLeft: '20px', lineHeight: 1.6, marginBottom: '20px' }}>
              <li>Everything in Monthly</li>
              <li>2 months entirely free</li>
              <li>Priority email support</li>
            </ul>
          </div>
        </div>

        <p style={{ textAlign: 'center', color: '#64748b', fontSize: '13px', marginTop: '20px', fontStyle: 'italic' }}>
          * Secure payments processed via Paystack. International cards accepted in USD.
        </p>

        <div style={{ marginTop: '30px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <button 
            className="glass-btn primary" 
            style={{ width: '100%', fontSize: '16px', fontWeight: 'bold' }}
            onClick={() => {
              // @ts-ignore
              initializePayment(onSuccess, onClose);
            }}
            disabled={loading}
          >
            {loading ? "Verifying..." : `Subscribe ${selectedPlan === 'monthly' ? '$10/mo' : '$100/yr'}`}
          </button>
          
          {hasTrial && (
            <button className="glass-btn" style={{ width: '100%' }} onClick={onSubscribeSuccess}>
              Continue with Free Trial
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
