// ============================================================
// Утилиты безопасности
// ============================================================

import { v4 as uuidv4 } from 'uuid';

/**
 * Простое хеширование пароля (для демо)
 * В продакшене использовать bcrypt на сервере
 */
export function hashPassword(password: string): string {
  let hash = 0;
  const salted = `debitor_salt_${password}_2024`;
  for (let i = 0; i < salted.length; i++) {
    const char = salted.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `hashed_${Math.abs(hash).toString(36)}_${salted.length}`;
}

/**
 * Проверка пароля
 */
export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

/**
 * Генерация уникального ID
 */
export function generateId(prefix: string = ''): string {
  return `${prefix}${prefix ? '-' : ''}${uuidv4()}`;
}

/**
 * Генерация криптографически случайного токена
 */
export function generateToken(): string {
  return uuidv4() + '-' + Date.now().toString(36);
}

/**
 * Хеширование токена для безопасного хранения
 */
export function hashToken(token: string): string {
  let hash = 0;
  const salted = `token_salt_${token}_secure`;
  for (let i = 0; i < salted.length; i++) {
    const char = salted.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `tok_${Math.abs(hash).toString(36)}`;
}

/**
 * Форматирование валюты
 */
export function formatCurrency(amountCents: number, currency: string = 'RUB'): string {
  const amount = amountCents / 100;
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Форматирование даты
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}
