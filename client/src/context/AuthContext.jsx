import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { api } from '../lib/api.js';
import { EMAIL_TO_COMMERCIALE, TORREFAZIONE_EMAILS, STORE_EMAIL_TO_NEGOZIO, FINANCE_EMAILS } from '../lib/constants.js';

// Client-side fallback used only until the server profile loads (or if the
// backend is unreachable). The server (/api/me) is the source of truth.
const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  // Server-authoritative profile: { email, commerciale, isAdmin }
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Whenever the session changes, ask the backend who we are.
  useEffect(() => {
    let active = true;
    if (!session) {
      setProfile(null);
      return undefined;
    }
    api
      .me()
      .then((p) => {
        if (active) setProfile(p);
      })
      .catch(() => {
        if (active) setProfile(null);
      });
    return () => {
      active = false;
    };
  }, [session]);

  const email = session?.user?.email?.toLowerCase() || null;
  const fallbackCommerciale = email ? EMAIL_TO_COMMERCIALE[email] || null : null;
  const fallbackAdmin = email ? adminEmails.includes(email) : false;
  const fallbackTorref = email ? TORREFAZIONE_EMAILS.includes(email) : false;
  const fallbackFinance = email ? FINANCE_EMAILS.includes(email) : false;
  const fallbackStore = email ? STORE_EMAIL_TO_NEGOZIO[email] || null : null;

  const value = {
    session,
    loading,
    user: session?.user || null,
    email,
    // Prefer the server profile once it has loaded; fall back to email mapping.
    commerciale: profile ? profile.commerciale : fallbackCommerciale,
    isAdmin: profile ? profile.isAdmin : fallbackAdmin,
    isTorrefazione: profile ? !!profile.isTorrefazione : fallbackTorref,
    isFinance: profile ? !!profile.isFinance : fallbackFinance,
    store: profile ? profile.store || null : fallbackStore,
    signIn: (e, p) => supabase.auth.signInWithPassword({ email: e, password: p }),
    signOut: () => supabase.auth.signOut(),
    // Update the logged-in user's password (Supabase Auth).
    updatePassword: (password) => supabase.auth.updateUser({ password }),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
