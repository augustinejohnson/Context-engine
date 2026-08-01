import React, { useState } from 'react';
import { usePaystackPayment } from 'react-paystack';
import { supabase } from '../lib/supabaseClient';

export default function SubscriptionScreen({ email, onSubscribeSuccess }: { email: string, onSubscribeSuccess: () => void }) {
  const [loading, setLoading] = useState(false);

  const config = {
    reference: (new Date()).getTime().toString(),
    email: email,
    amount: 15000 * 100, // Paystack amount is in kobo (e.g. 15,000 NGN)
    publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '',
  };

  const initializePayment = usePaystackPayment(config);

  const onSuccess = async (reference: any) => {
    setLoading(true);
    // Ping backend to verify transaction and activate subscription
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`http://${window.location.hostname}:3001/api/verify_payment`, {
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

  return (
    <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '40px', backgroundColor: '#1e293b', borderRadius: '12px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
        <h2 style={{ color: '#fff', marginBottom: '10px' }}>Active Subscription Required</h2>
        <p style={{ color: '#94a3b8', marginBottom: '30px' }}>To use the Context Engine SaaS globally, you need an active subscription.</p>
        <button 
          onClick={() => {
            // @ts-ignore
            initializePayment(onSuccess, onClose);
          }}
          disabled={loading}
          style={{
            padding: '12px 24px',
            backgroundColor: '#0ea5e9',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            width: '100%'
          }}
        >
          {loading ? "Verifying..." : "Subscribe Now (₦15,000 / mo)"}
        </button>
      </div>
    </div>
  );
}
