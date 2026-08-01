"use client";
import React, { useState } from 'react';
import { usePaystackPayment } from 'react-paystack';
import { supabase } from '../lib/supabaseClient';

export default function SubscriptionScreen({ email, onSubscribeSuccess, trialEndsAt }: { email: string, onSubscribeSuccess: () => void, trialEndsAt?: string }) {
  const [loading, setLoading] = useState(false);

  const config = {
    reference: (new Date()).getTime().toString(),
    email: email,
    amount: 15000 * 100, // Paystack amount is in kobo (e.g. 15,000 NGN)
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
      
      <div className="subscription-card glass-panel" style={{ maxWidth: '600px', width: '100%' }}>
        <h2 className="auth-title gradient-text" style={{ textAlign: 'center', marginBottom: '10px' }}>Choose Your Plan</h2>
        <p style={{ textAlign: 'center', color: '#94a3b8', marginBottom: '30px' }}>
          {hasTrial 
            ? `You have a free trial active until ${new Date(trialEndsAt).toLocaleDateString()}! Upgrade early to secure your price.` 
            : `Your trial has expired. Upgrade to continue using Corpus.`}
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="plan-tier glass-panel" style={{ padding: '20px', background: 'rgba(255,255,255,0.02)' }}>
            <h3 style={{ margin: 0, color: '#fff' }}>Pro Monthly</h3>
            <p className="gradient-text" style={{ fontSize: '32px', fontWeight: 'bold', margin: '10px 0' }}>₦15,000<span style={{ fontSize: '16px', color: '#94a3b8' }}>/mo</span></p>
            <ul style={{ color: '#cbd5e1', paddingLeft: '20px', lineHeight: 1.6, marginBottom: '20px' }}>
              <li>Unlimited Live Transcripts & Translations</li>
              <li>AI Smart Scripture & Lyrics Staging</li>
              <li>Premium Lower Thirds & Overlays</li>
            </ul>
            <button 
              className="glass-btn primary" 
              style={{ width: '100%', fontSize: '16px', fontWeight: 'bold' }}
              onClick={() => {
                // @ts-ignore
                initializePayment(onSuccess, onClose);
              }}
              disabled={loading}
            >
              {loading ? "Verifying..." : "Subscribe Now"}
            </button>
          </div>
          
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
