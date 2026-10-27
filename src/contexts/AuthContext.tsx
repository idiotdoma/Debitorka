import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Organization, AuthSession, Team } from '../types/models';
import { userStore, orgStore, authStore, teamStore } from '../lib/store';
import { hashPassword, verifyPassword, generateId, generateToken } from '../lib/utils';
import { initializeDemoData } from '../lib/seed';

interface AuthContextType {
  user: User | null;
  organization: Organization | null;
  team: Team | null;
  session: AuthSession | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, firstName: string, orgName: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      initializeDemoData();
      
      const savedSession = authStore.getSession();
      if (savedSession) {
        const foundUser = userStore.getById(savedSession.userId);
        const foundOrg = orgStore.getById(savedSession.organizationId);
        if (foundUser && foundOrg) {
          setUser(foundUser);
          setOrganization(foundOrg);
          setSession(savedSession);
          
          if (foundUser.teamId) {
            const foundTeam = teamStore.getById(foundUser.teamId, foundOrg.id, savedSession);
            setTeam(foundTeam || null);
          }
        } else {
          authStore.clearSession();
        }
      }
    } catch (error) {
      console.error('Error during initialization:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const foundUser = userStore.getByEmail(email);
    if (!foundUser) {
      return { success: false, error: 'Пользователь не найден' };
    }
    
    if (foundUser.isActive === false) {
      return { success: false, error: 'Учётная запись деактивирована' };
    }
    
    if (!verifyPassword(password, foundUser.passwordHash)) {
      return { success: false, error: 'Неверный пароль' };
    }
    
    const org = orgStore.getById(foundUser.organizationId);
    if (!org) {
      return { success: false, error: 'Организация не найдена' };
    }
    
    const newSession: AuthSession = {
      userId: foundUser.id,
      organizationId: foundUser.organizationId,
      token: generateToken(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
    
    authStore.setSession(newSession);
    userStore.update(foundUser.id, { lastLoginAt: new Date().toISOString() });
    
    setUser(foundUser);
    setOrganization(org);
    setSession(newSession);
    
    if (foundUser.teamId) {
      const foundTeam = teamStore.getById(foundUser.teamId, org.id, newSession);
      setTeam(foundTeam || null);
    }
    
    return { success: true };
  };

  const register = async (email: string, password: string, firstName: string, orgName: string) => {
    if (userStore.getByEmail(email)) {
      return { success: false, error: 'Email уже зарегистрирован' };
    }
    
    const org: Organization = {
      id: generateId('org'),
      name: orgName,
      timezone: 'Europe/Moscow',
      staleDataThresholdHours: 24,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    orgStore.create(org);
    
    const newUser: User = {
      id: generateId('user'),
      email,
      passwordHash: hashPassword(password),
      name: firstName,
      firstName,
      organizationId: org.id,
      role: 'owner',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    userStore.create(newUser);
    
    const newSession: AuthSession = {
      userId: newUser.id,
      organizationId: org.id,
      token: generateToken(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
    
    authStore.setSession(newSession);
    setUser(newUser);
    setOrganization(org);
    setSession(newSession);
    
    return { success: true };
  };

  const logout = () => {
    authStore.clearSession();
    setUser(null);
    setOrganization(null);
    setTeam(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ user, organization, team, session, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
