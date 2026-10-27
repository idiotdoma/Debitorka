// ============================================================
// Сервис уведомлений — генерация и обработка уведомлений
// Использует единую календарную логику из calendarService
// ============================================================

import { Notification, NotificationType, Task, PaymentPromise, UUID } from '../types/models';
import { notificationStore, taskStore, promiseStore, userStore } from './store';
import { generateId } from './calculations';
import { isTaskOverdue, daysUntilTaskDue, isPromiseNeedsCheck, promiseOverdueDays, getTodayInTimezone } from './calendarService';
import { orgStore } from './store';

/**
 * Получает часовой пояс организации
 */
function getOrgTimezone(organizationId: UUID): string {
  const org = orgStore.getById(organizationId);
  return org?.timezone || 'Europe/Moscow';
}

/**
 * Проверяет и создаёт уведомления о просроченных задачах
 * ВАЖНО: завершённые и отменённые задачи не считаются просроченными
 */
export function checkOverdueTasks(organizationId: UUID): void {
  const session = { userId: 'system', organizationId, token: 'system', expiresAt: '2099-01-01' };
  const tasks = taskStore.getAll(organizationId, session);
  const timezone = getOrgTimezone(organizationId);
  
  for (const task of tasks) {
    // Пропускаем завершённые и отменённые задачи
    if (task.status === 'completed' || task.status === 'cancelled') continue;
    
    // Проверяем просрочку через единую функцию
    if (!isTaskOverdue(task, timezone)) continue;
    
    const overdueDays = promiseOverdueDays({ ...task, promisedDate: task.dueDate, status: 'expected' } as any, timezone);
    
    // Уведомление о просроченной задаче
    const idempotencyKey = `task_overdue_${task.id}_${getTodayInTimezone(timezone)}`;
    
    const notification: Notification = {
      id: generateId('notif'),
      organizationId,
      recipientId: task.assignedTo,
      type: 'task_overdue',
      title: 'Задача просрочена',
      message: `Задача "${task.title}" просрочена на ${overdueDays} дн. Срок был: ${task.dueDate}`,
      relatedTaskId: task.id,
      relatedCounterparty: task.counterpartyName,
      isRead: false,
      createdAt: new Date().toISOString(),
      idempotencyKey,
    };
    
    notificationStore.create(notification);
  }
}

/**
 * Проверяет и создаёт уведомления о приближающихся сроках задач (за 24 часа)
 */
export function checkUpcomingTasks(organizationId: UUID): void {
  const session = { userId: 'system', organizationId, token: 'system', expiresAt: '2099-01-01' };
  const tasks = taskStore.getAll(organizationId, session);
  const timezone = getOrgTimezone(organizationId);
  
  for (const task of tasks) {
    if (task.status === 'completed' || task.status === 'cancelled') continue;
    
    const daysUntil = daysUntilTaskDue(task, timezone);
    
    // Уведомление за 1 день (срок сегодня или завтра)
    if (daysUntil === 0 || daysUntil === 1) {
      const idempotencyKey = `task_due_soon_${task.id}_${getTodayInTimezone(timezone)}`;
      
      const message = daysUntil === 0
        ? `Задача "${task.title}" должна быть выполнена сегодня`
        : `Задача "${task.title}" должна быть выполнена завтра`;
      
      const notification: Notification = {
        id: generateId('notif'),
        organizationId,
        recipientId: task.assignedTo,
        type: 'task_due_soon',
        title: 'Срок задачи приближается',
        message,
        relatedTaskId: task.id,
        relatedCounterparty: task.counterpartyName,
        isRead: false,
        createdAt: new Date().toISOString(),
        idempotencyKey,
      };
      
      notificationStore.create(notification);
    }
  }
}

/**
 * Проверяет обещания и создаёт уведомления о требующих проверки
 * ВАЖНО: наступившая дата НЕ означает нарушение — только требование проверки
 */
export function checkOverduePromises(organizationId: UUID): void {
  const session = { userId: 'system', organizationId, token: 'system', expiresAt: '2099-01-01' };
  const promises = promiseStore.getAll(organizationId, session);
  const timezone = getOrgTimezone(organizationId);
  
  for (const promise of promises) {
    if (promise.status !== 'expected') continue;
    
    // Проверяем, требует ли обещание проверки
    if (!isPromiseNeedsCheck(promise, timezone)) continue;
    
    const overdueDays = promiseOverdueDays(promise, timezone);
    
    // Уведомление о требующем проверки обещании (НЕ о нарушении!)
    const idempotencyKey = `promise_needs_check_${promise.id}_${getTodayInTimezone(timezone)}`;
    
    const message = overdueDays > 0
      ? `Обещание оплаты от ${promise.contactName} просрочено на ${overdueDays} дн. Требуется проверка.`
      : `Сегодня срок обещания оплаты от ${promise.contactName}. Проверьте результат.`;
    
    const notification: Notification = {
      id: generateId('notif'),
      organizationId,
      recipientId: promise.employeeId,
      type: 'promise_needs_check',
      title: 'Обещание оплаты требует проверки',
      message,
      relatedPromiseId: promise.id,
      relatedCounterparty: promise.counterpartyName,
      isRead: false,
      createdAt: new Date().toISOString(),
      idempotencyKey,
    };
    
    notificationStore.create(notification);
  }
}

/**
 * Запускает все проверки уведомлений
 */
export function runNotificationChecks(organizationId: UUID): void {
  checkOverdueTasks(organizationId);
  checkUpcomingTasks(organizationId);
  checkOverduePromises(organizationId);
}

/**
 * Создаёт уведомление о новой задаче
 */
export function notifyNewTask(task: Task): void {
  const notification: Notification = {
    id: generateId('notif'),
    organizationId: task.organizationId,
    recipientId: task.assignedTo,
    type: 'new_task_assigned',
    title: 'Новая задача',
    message: `Вам назначена задача: "${task.title}"`,
    relatedTaskId: task.id,
    relatedCounterparty: task.counterpartyName,
    isRead: false,
    createdAt: new Date().toISOString(),
    idempotencyKey: `new_task_${task.id}_${task.createdAt}`,
  };
  
  notificationStore.create(notification);
}

/**
 * Создаёт уведомление об эскалации критической задачи руководителю
 */
export function notifyCriticalTaskEscalation(task: Task, headUserId: UUID): void {
  if (task.priority !== 'critical') return;
  if (task.status === 'completed' || task.status === 'cancelled') return;
  
  const timezone = getOrgTimezone(task.organizationId);
  const overdueDays = promiseOverdueDays({ ...task, promisedDate: task.dueDate, status: 'expected' } as any, timezone);
  
  if (overdueDays < 1) return; // Эскалация только после 1 дня просрочки
  
  const idempotencyKey = `critical_escalation_${task.id}_${getTodayInTimezone(timezone)}`;
  
  const notification: Notification = {
    id: generateId('notif'),
    organizationId: task.organizationId,
    recipientId: headUserId,
    type: 'critical_task_escalation',
    title: 'Критическая задача просрочена',
    message: `Критическая задача "${task.title}" просрочена на ${overdueDays} дн. Ответственный: ${task.assignedTo}`,
    relatedTaskId: task.id,
    relatedCounterparty: task.counterpartyName,
    isRead: false,
    createdAt: new Date().toISOString(),
    idempotencyKey,
  };
  
  notificationStore.create(notification);
}
