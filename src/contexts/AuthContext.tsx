import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase, getCurrentUser, getUserOrganizations, Profile, Organization, OrganizationMembership } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  organizations: (OrganizationMembership & { organization: Organization })[];
  currentOrganization: Organization | null;
  currentMembership: OrganizationMembership | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, fullName: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  switchOrganization: (orgId: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organizations, setOrganizations] = useState<(OrganizationMembership & { organization: Organization })[]>([]);
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [currentMembership, setCurrentMembership] = useState<OrganizationMembership | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadUserData(session.user);
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadUserData(session.user);
      } else {
        setUser(null);
        setProfile(null);
        setOrganizations([]);
        setCurrentOrganization(null);
        setCurrentMembership(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadUserData(authUser: User) {
    try {
      const userData = await getCurrentUser();
      if (userData) {
        setUser(authUser);
        setProfile(userData.profile);
        
        const orgs = await getUserOrganizations();
        setOrganizations(orgs);
        
        // Load last used organization or first one
        const lastOrgId = localStorage.getItem('lastOrganizationId');
        const selectedOrg = lastOrgId 
          ? orgs.find(o => o.organization_id === lastOrgId)
          : orgs[0];
        
        if (selectedOrg) {
          setCurrentOrganization(selectedOrg.organization);
          setCurrentMembership(selectedOrg);
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(email: string, password: string) {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Login failed' };
    }
  }

  async function register(email: string, password: string, fullName: string) {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      });
      
      if (error) {
        return { success: false, error: error.message };
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Registration failed' };
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    localStorage.removeItem('lastOrganizationId');
  }

  function switchOrganization(orgId: string) {
    const org = organizations.find(o => o.organization_id === orgId);
    if (org) {
      setCurrentOrganization(org.organization);
      setCurrentMembership(org);
      localStorage.setItem('lastOrganizationId', orgId);
    }
  }

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      organizations,
      currentOrganization,
      currentMembership,
      isLoading,
      login,
      register,
      logout,
      switchOrganization,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
