// ============================================================
// Тесты для этапа 3: задачи, коммуникации, уведомления
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { taskStore, communicationStore, notificationStore, orgStore, userStore, debtStore, resetAllData } from '../lib/store';
import { hashPassword, generateId, generateDocumentKey } from '../lib/calculations';
import { runNotificationChecks, notifyNewTask } from '../lib/notificationService';
import type { Organization, User, AuthSession, Task, Communication, DebtRecord, UserRole } from '../types/models';

function makeOrg(id: string): Organization {
  return { id, name: 'Test', timezone: 'Europe/Moscow', staleDataThresholdHours: 24, createdAt: new Date().toISOString() };
}

function makeUser(id: string, email: string, orgId: string, role: UserRole = 'employee'): User {
  return { id, email, passwordHash: hashPassword('pass'), name: email, organizationId: orgId, role, createdAt: new Date().toISOString() };
}

function makeSession(userId: string, orgId: string): AuthSession {
  return { userId, organizationId: orgId, token: 'token', expiresAt: new Date(Date.now() + 86400000).toISOString() };
}

describe('Stage 3: Tasks', () => {
  let orgId: string;
  let session: AuthSession;
  let userId: string;

  beforeEach(() => {
    resetAllData();
    orgId = 'org-task-test';
    userId = 'user-task-test';
    orgStore.create(makeOrg(orgId));
    userStore.create(makeUser(userId, 'test@test.ru', orgId));
    session = makeSession(userId, orgId);
  });

  it('creates a task', () => {
    const task: Task = {
      id: generateId('task'),
      organizationId: orgId,
      title: 'Test task',
      type: 'call_counterparty',
      priority: 'normal',
      status: 'new',
      assignedTo: userId,
      createdBy: userId,
      dueDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    taskStore.create(task);
    const tasks = taskStore.getAll(orgId, session);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Test task');
  });

  it('filters tasks by assignee', () => {
    const user2 = 'user-2';
    userStore.create(makeUser(user2, 'test2@test.ru', orgId));
    
    const task1: Task = {
      id: generateId('task'),
      organizationId: orgId,
      title: 'Task 1',
      type: 'call_counterparty',
      priority: 'normal',
      status: 'new',
      assignedTo: userId,
      createdBy: userId,
      dueDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const task2: Task = {
      id: generateId('task'),
      organizationId: orgId,
      title: 'Task 2',
      type: 'call_counterparty',
      priority: 'normal',
      status: 'new',
      assignedTo: user2,
      createdBy: userId,
      dueDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    taskStore.create(task1);
    taskStore.create(task2);
    
    const myTasks = taskStore.getByAssignee(userId, orgId, session);
    expect(myTasks).toHaveLength(1);
    expect(myTasks[0].title).toBe('Task 1');
  });

  it('updates task status', () => {
    const task: Task = {
      id: generateId('task'),
      organizationId: orgId,
      title: 'Test task',
      type: 'call_counterparty',
      priority: 'normal',
      status: 'new',
      assignedTo: userId,
      createdBy: userId,
      dueDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    taskStore.create(task);
    taskStore.update(task.id, { status: 'completed', completedAt: new Date().toISOString() }, orgId, session);
    
    const updated = taskStore.getById(task.id, orgId, session);
    expect(updated?.status).toBe('completed');
    expect(updated?.completedAt).toBeDefined();
  });
});

describe('Stage 3: Communications', () => {
  let orgId: string;
  let session: AuthSession;
  let userId: string;

  beforeEach(() => {
    resetAllData();
    orgId = 'org-comm-test';
    userId = 'user-comm-test';
    orgStore.create(makeOrg(orgId));
    userStore.create(makeUser(userId, 'test@test.ru', orgId));
    session = makeSession(userId, orgId);
  });

  it('creates a communication', () => {
    const comm: Communication = {
      id: generateId('comm'),
      organizationId: orgId,
      counterpartyName: 'Test Client',
      type: 'outgoing_call',
      direction: 'outgoing',
      contactDate: new Date().toISOString(),
      employeeId: userId,
      summary: 'Discussed payment terms',
      createdBy: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    communicationStore.create(comm);
    const comms = communicationStore.getAll(orgId, session);
    expect(comms).toHaveLength(1);
    expect(comms[0].counterpartyName).toBe('Test Client');
  });

  it('filters communications by counterparty', () => {
    const comm1: Communication = {
      id: generateId('comm'),
      organizationId: orgId,
      counterpartyName: 'Client A',
      type: 'outgoing_call',
      direction: 'outgoing',
      contactDate: new Date().toISOString(),
      employeeId: userId,
      summary: 'Call 1',
      createdBy: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const comm2: Communication = {
      id: generateId('comm'),
      organizationId: orgId,
      counterpartyName: 'Client B',
      type: 'outgoing_call',
      direction: 'outgoing',
      contactDate: new Date().toISOString(),
      employeeId: userId,
      summary: 'Call 2',
      createdBy: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    communicationStore.create(comm1);
    communicationStore.create(comm2);
    
    const clientAComms = communicationStore.getByCounterparty('Client A', orgId, session);
    expect(clientAComms).toHaveLength(1);
    expect(clientAComms[0].summary).toBe('Call 1');
  });
});

describe('Stage 3: Notifications', () => {
  let orgId: string;
  let session: AuthSession;
  let userId: string;

  beforeEach(() => {
    resetAllData();
    orgId = 'org-notif-test';
    userId = 'user-notif-test';
    orgStore.create(makeOrg(orgId));
    userStore.create(makeUser(userId, 'test@test.ru', orgId));
    session = makeSession(userId, orgId);
  });

  it('creates notification with idempotency', () => {
    const task: Task = {
      id: generateId('task'),
      organizationId: orgId,
      title: 'Test task',
      type: 'call_counterparty',
      priority: 'normal',
      status: 'new',
      assignedTo: userId,
      createdBy: userId,
      dueDate: new Date(Date.now() - 86400000).toISOString(), // Yesterday
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    taskStore.create(task);
    
    // Run notification check
    runNotificationChecks(orgId);
    
    const notifications = notificationStore.getByRecipient(userId, orgId, session);
    expect(notifications.length).toBeGreaterThan(0);
    
    // Run again - should not create duplicates
    runNotificationChecks(orgId);
    const notificationsAfter = notificationStore.getByRecipient(userId, orgId, session);
    expect(notificationsAfter.length).toBe(notifications.length);
  });

  it('marks notification as read', () => {
    const task: Task = {
      id: generateId('task'),
      organizationId: orgId,
      title: 'Test task',
      type: 'call_counterparty',
      priority: 'normal',
      status: 'new',
      assignedTo: userId,
      createdBy: userId,
      dueDate: new Date(Date.now() - 86400000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    taskStore.create(task);
    runNotificationChecks(orgId);
    
    const notifications = notificationStore.getByRecipient(userId, orgId, session);
    expect(notifications[0].isRead).toBe(false);
    
    notificationStore.markAsRead(notifications[0].id, userId, orgId, session);
    
    const updated = notificationStore.getByRecipient(userId, orgId, session);
    expect(updated[0].isRead).toBe(true);
  });

  it('notifies on new task assignment', () => {
    const task: Task = {
      id: generateId('task'),
      organizationId: orgId,
      title: 'New task',
      type: 'call_counterparty',
      priority: 'normal',
      status: 'new',
      assignedTo: userId,
      createdBy: userId,
      dueDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    notifyNewTask(task);
    
    const notifications = notificationStore.getByRecipient(userId, orgId, session);
    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe('new_task_assigned');
  });
});

describe('Stage 3: Tenant Isolation', () => {
  let orgA: string, orgB: string;
  let sessionA: AuthSession, sessionB: AuthSession;

  beforeEach(() => {
    resetAllData();
    orgA = 'org-a';
    orgB = 'org-b';
    orgStore.create(makeOrg(orgA));
    orgStore.create(makeOrg(orgB));
    userStore.create(makeUser('user-a', 'a@test.ru', orgA));
    userStore.create(makeUser('user-b', 'b@test.ru', orgB));
    sessionA = makeSession('user-a', orgA);
    sessionB = makeSession('user-b', orgB);
  });

  it('User A cannot see tasks of Organization B', () => {
    const task: Task = {
      id: generateId('task'),
      organizationId: orgB,
      title: 'Secret task',
      type: 'call_counterparty',
      priority: 'normal',
      status: 'new',
      assignedTo: 'user-b',
      createdBy: 'user-b',
      dueDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    taskStore.create(task);
    
    const tasksA = taskStore.getAll(orgA, sessionA);
    expect(tasksA).toHaveLength(0);
    
    const tasksB = taskStore.getAll(orgB, sessionB);
    expect(tasksB).toHaveLength(1);
  });

  it('User A cannot see communications of Organization B', () => {
    const comm: Communication = {
      id: generateId('comm'),
      organizationId: orgB,
      counterpartyName: 'Secret Client',
      type: 'outgoing_call',
      direction: 'outgoing',
      contactDate: new Date().toISOString(),
      employeeId: 'user-b',
      summary: 'Secret call',
      createdBy: 'user-b',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    communicationStore.create(comm);
    
    const commsA = communicationStore.getAll(orgA, sessionA);
    expect(commsA).toHaveLength(0);
  });

  it('User A cannot see notifications of Organization B', () => {
    const task: Task = {
      id: generateId('task'),
      organizationId: orgB,
      title: 'Task B',
      type: 'call_counterparty',
      priority: 'normal',
      status: 'new',
      assignedTo: 'user-b',
      createdBy: 'user-b',
      dueDate: new Date(Date.now() - 86400000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    taskStore.create(task);
    runNotificationChecks(orgB);
    
    const notifsA = notificationStore.getAll(orgA, sessionA);
    expect(notifsA).toHaveLength(0);
  });
});
