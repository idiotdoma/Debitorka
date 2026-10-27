// ============================================================
// Auth Context — управление сессией
// ============================================================

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, AuthSession, Organization } from '../types/models';
import { authStore, userStore, orgStore } from '../lib/store';
import { hashPassword, verifyPassword, generateId } from '../lib/calculations';
import { initializeDemoData } from '../lib/seed';

interface AuthContextType {
  user: User | null;
  organization: Organization | null;
  session: AuthSession | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, name: string, orgName: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      // Инициализируем демо-данные
      initializeDemoData();
      
      // Восстанавливаем сессию
      const savedSession = authStore.getSession();
      if (savedSession) {
        const foundUser = userStore.getById(savedSession.userId);
        const foundOrg = orgStore.getById(savedSession.organizationId);
        if (foundUser && foundOrg) {
          setUser(foundUser);
          setOrganization(foundOrg);
          setSession(savedSession);
        } else {
          authStore.clearSession();
        }
      }
    } catch (error) {
      console.error('Error during initialization:', error);
      // При ошибке инициализации — очищаем только ключи приложения
      const appKeys = Object.keys(localStorage).filter(key => key.startsWith('debitor_'));
      appKeys.forEach(key => localStorage.removeItem(key));
      try {
        initializeDemoData();
      } catch (e) {
        console.error('Failed to reinitialize:', e);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const foundUser = userStore.getByEmail(email);
    if (!foundUser) {
      return { success: false, error: 'Пользователь не найден' };
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
      token: generateId('token'),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 часа
    };
    
    authStore.setSession(newSession);
    setUser(foundUser);
    setOrganization(org);
    setSession(newSession);
    
    return { success: true };
  }, []);

  const register = useCallback(async (email: string, password: string, name: string, orgName: string) => {
    // Проверка уникальности email
    if (userStore.getByEmail(email)) {
      return { success: false, error: 'Email уже зарегистрирован' };
    }
    
    // Создаём организацию
    const org: Organization = {
      id: generateId('org'),
      name: orgName,
      timezone: 'Europe/Moscow',
      staleDataThresholdHours: 24,
      createdAt: new Date().toISOString(),
    };
    orgStore.create(org);
    
    // Создаём пользователя
    const newUser: User = {
      id: generateId('user'),
      email,
      passwordHash: hashPassword(password),
      name,
      organizationId: org.id,
      role: 'admin',
      createdAt: new Date().toISOString(),
    };
    userStore.create(newUser);
    
    // Автоматически логиним
    const newSession: AuthSession = {
      userId: newUser.id,
      organizationId: org.id,
      token: generateId('token'),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
    
    authStore.setSession(newSession);
    setUser(newUser);
    setOrganization(org);
    setSession(newSession);
    
    return { success: true };
  }, []);

  const logout = useCallback(() => {
    authStore.clearSession();
    setUser(null);
    setOrganization(null);
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, organization, session, isLoading, login, register, logout }}>
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
