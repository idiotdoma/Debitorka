// ============================================================
// Единый модуль календарных расчётов
// Все операции с датами и просрочками должны использовать эти функции
// ============================================================

import { Task, PaymentPromise } from '../types/models';

/**
 * Получает текущую календарную дату в указанном часовом поясе
 * Возвращает дату в формате YYYY-MM-DD
 */
export function getTodayInTimezone(timezone: string = 'Europe/Moscow'): string {
  const now = new Date();
  
  try {
    // Используем Intl.DateTimeFormat для корректной работы с часовыми поясами
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    
    return formatter.format(now);
  } catch {
    // Fallback на локальное время, если часовой пояс не поддерживается
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

/**
 * Вычисляет разницу в календарных днях между двумя датами
 * Не зависит от времени суток и часовых поясов
 * Возвращает положительное число если date1 > date2, отрицательное если date1 < date2
 */
export function calendarDaysDiff(date1: string, date2: string): number {
  const d1 = new Date(date1 + 'T00:00:00');
  const d2 = new Date(date2 + 'T00:00:00');
  
  // Используем UTC для избежания проблем с DST
  const time1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const time2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
  
  return Math.round((time1 - time2) / (1000 * 60 * 60 * 24));
}

/**
 * Определяет, просрочена ли задача
 * Задача просрочена, если срок выполнения прошёл и задача не завершена/не отменена
 */
export function isTaskOverdue(task: Task, timezone?: string): boolean {
  // Завершённые и отменённые задачи не считаются просроченными
  if (task.status === 'completed' || task.status === 'cancelled') {
    return false;
  }
  
  const today = getTodayInTimezone(timezone);
  const daysDiff = calendarDaysDiff(today, task.dueDate);
  
  // Просрочена, если сегодня позже срока выполнения
  return daysDiff > 0;
}

/**
 * Определяет, наступает ли срок задачи сегодня
 */
export function isTaskDueToday(task: Task, timezone?: string): boolean {
  if (task.status === 'completed' || task.status === 'cancelled') {
    return false;
  }
  
  const today = getTodayInTimezone(timezone);
  return task.dueDate === today;
}

/**
 * Вычисляет количество календарных дней до срока задачи
 * Отрицательное значение означает просрочку
 */
export function daysUntilTaskDue(task: Task, timezone?: string): number {
  const today = getTodayInTimezone(timezone);
  return calendarDaysDiff(task.dueDate, today);
}

/**
 * Вычисляет количество дней просрочки задачи
 * Возвращает 0 если задача не просрочена
 */
export function taskOverdueDays(task: Task, timezone?: string): number {
  if (!isTaskOverdue(task, timezone)) {
    return 0;
  }
  
  const today = getTodayInTimezone(timezone);
  return calendarDaysDiff(today, task.dueDate);
}

/**
 * Определяет, требует ли обещание оплаты проверки
 * Обещание требует проверки, если дата наступила или прошла
 */
export function isPromiseNeedsCheck(promise: PaymentPromise, timezone?: string): boolean {
  // Только ожидаемые обещания требуют проверки
  if (promise.status !== 'expected') {
    return false;
  }
  
  const today = getTodayInTimezone(timezone);
  const daysDiff = calendarDaysDiff(today, promise.promisedDate);
  
  // Требует проверки, если дата наступила или прошла
  return daysDiff >= 0;
}

/**
 * Вычисляет количество дней просрочки обещания оплаты
 * Возвращает 0 если обещание не просрочено
 */
export function promiseOverdueDays(promise: PaymentPromise, timezone?: string): number {
  if (promise.status !== 'expected') {
    return 0;
  }
  
  const today = getTodayInTimezone(timezone);
  const daysDiff = calendarDaysDiff(today, promise.promisedDate);
  
  return Math.max(0, daysDiff);
}

/**
 * Определяет, наступает ли срок обещания сегодня
 */
export function isPromiseDueToday(promise: PaymentPromise, timezone?: string): boolean {
  if (promise.status !== 'expected') {
    return false;
  }
  
  const today = getTodayInTimezone(timezone);
  return promise.promisedDate === today;
}

/**
 * Вычисляет количество дней до срока обещания
 * Отрицательное значение означает просрочку
 */
export function daysUntilPromiseDue(promise: PaymentPromise, timezone?: string): number {
  const today = getTodayInTimezone(timezone);
  return calendarDaysDiff(promise.promisedDate, today);
}

/**
 * Проверяет, является ли дата в прошлом
 */
export function isDateInPast(date: string, timezone?: string): boolean {
  const today = getTodayInTimezone(timezone);
  return calendarDaysDiff(today, date) > 0;
}

/**
 * Проверяет, является ли дата сегодня
 */
export function isDateToday(date: string, timezone?: string): boolean {
  const today = getTodayInTimezone(timezone);
  return date === today;
}

/**
 * Проверяет, является ли дата в будущем
 */
export function isDateInFuture(date: string, timezone?: string): boolean {
  const today = getTodayInTimezone(timezone);
  return calendarDaysDiff(today, date) < 0;
}
