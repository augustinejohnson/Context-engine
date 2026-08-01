-- Supabase SaaS Upgrade: 7-Day Free Trial & Admin Settings
-- PASTE AND RUN THIS ENTIRE FILE IN YOUR SUPABASE SQL EDITOR!

-- 1. Add trial_ends_at to existing user_profiles table
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE;

-- 2. Create global_settings table for the Master AI API Key
CREATE TABLE IF NOT EXISTS public.global_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    openai_api_key TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert a default blank row if it doesn't exist
INSERT INTO public.global_settings (id, openai_api_key)
SELECT uuid_generate_v4(), ''
WHERE NOT EXISTS (SELECT 1 FROM public.global_settings);

-- 3. Create a Postgres Trigger to automatically grant a 7-day trial to new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, tenant_id, subscription_status, trial_ends_at)
  VALUES (
    NEW.id, 
    uuid_generate_v4(), 
    'inactive', 
    NOW() + INTERVAL '7 days'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger if it exists to avoid errors, then recreate it
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. Give the Service Role (Backend) access to the new table
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service Role can read/write global settings" ON public.global_settings FOR ALL USING (auth.role() = 'service_role');
