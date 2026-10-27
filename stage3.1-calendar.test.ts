// ============================================================
// Тесты календарных расчётов — Stage 3.1
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getTodayInTimezone,
  calendarDaysDiff,
  isTaskOverdue,
  isTaskDueToday,
  daysUntilTaskDue,
  taskOverdueDays,
  isPromiseNeedsCheck,
  promiseOverdueDays,
} from '../lib/calendarService';
import type { Task, PaymentPromise } from '../types/models';

describe('Calendar Service (Stage 3.1)', () => {
  describe('calendarDaysDiff', () => {
    it('returns 0 for same date', () => {
      expect(calendarDaysDiff('2024-06-15', '2024-06-15')).toBe(0);
    });

    it('returns positive for later date', () => {
      expect(calendarDaysDiff('2024-06-16', '2024-06-15')).toBe(1);
    });

    it('returns negative for earlier date', () => {
      expect(calendarDaysDiff('2024-06-14', '2024-06-15')).toBe(-1);
    });

    it('handles month boundaries', () => {
      expect(calendarDaysDiff('2024-07-01', '2024-06-30')).toBe(1);
    });

    it('handles year boundaries', () => {
      expect(calendarDaysDiff('2025-01-01', '2024-12-31')).toBe(1);
    });

    it('handles leap year', () => {
      expect(calendarDaysDiff('2024-03-01', '2024-02-29')).toBe(1);
    });
  });

  describe('isTaskOverdue', () => {
    const mockTask = (dueDate: string, status: string): Task => ({
      id: 'test',
      organizationId: 'org',
      title: 'Test',
      type: 'call_counterparty',
      priority: 'normal',
      status: status as any,
      assignedTo: 'user',
      createdBy: 'user',
      dueDate,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    });

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-06-15T12:00:00'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns false for completed task', () => {
      expect(isTaskOverdue(mockTask('2024-06-10', 'completed'))).toBe(false);
    });

    it('returns false for cancelled task', () => {
      expect(isTaskOverdue(mockTask('2024-06-10', 'cancelled'))).toBe(false);
    });

    it('returns false for task due today', () => {
      expect(isTaskOverdue(mockTask('2024-06-15', 'new'))).toBe(false);
    });

    it('returns false for task due tomorrow', () => {
      expect(isTaskOverdue(mockTask('2024-06-16', 'new'))).toBe(false);
    });

    it('returns true for task due yesterday', () => {
      expect(isTaskOverdue(mockTask('2024-06-14', 'new'))).toBe(true);
    });

    it('returns true for task due last week', () => {
      expect(isTaskOverdue(mockTask('2024-06-08', 'in_progress'))).toBe(true);
    });
  });

  describe('isTaskDueToday', () => {
    const mockTask = (dueDate: string): Task => ({
      id: 'test',
      organizationId: 'org',
      title: 'Test',
      type: 'call_counterparty',
      priority: 'normal',
      status: 'new',
      assignedTo: 'user',
      createdBy: 'user',
      dueDate,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    });

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-06-15T12:00:00'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns true for task due today', () => {
      expect(isTaskDueToday(mockTask('2024-06-15'))).toBe(true);
    });

    it('returns false for task due tomorrow', () => {
      expect(isTaskDueToday(mockTask('2024-06-16'))).toBe(false);
    });

    it('returns false for task due yesterday', () => {
      expect(isTaskDueToday(mockTask('2024-06-14'))).toBe(false);
    });
  });

  describe('taskOverdueDays', () => {
    const mockTask = (dueDate: string, status: string = 'new'): Task => ({
      id: 'test',
      organizationId: 'org',
      title: 'Test',
      type: 'call_counterparty',
      priority: 'normal',
      status: status as any,
      assignedTo: 'user',
      createdBy: 'user',
      dueDate,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    });

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-06-15T12:00:00'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns 0 for task due today', () => {
      expect(taskOverdueDays(mockTask('2024-06-15'))).toBe(0);
    });

    it('returns 0 for task due tomorrow', () => {
      expect(taskOverdueDays(mockTask('2024-06-16'))).toBe(0);
    });

    it('returns 1 for task due yesterday', () => {
      expect(taskOverdueDays(mockTask('2024-06-14'))).toBe(1);
    });

    it('returns 7 for task due last week', () => {
      expect(taskOverdueDays(mockTask('2024-06-08'))).toBe(7);
    });

    it('returns 0 for completed task', () => {
      expect(taskOverdueDays(mockTask('2024-06-08', 'completed'))).toBe(0);
    });
  });

  describe('Promise checks', () => {
    const mockPromise = (promisedDate: string, status: string = 'expected'): PaymentPromise => ({
      id: 'test',
      organizationId: 'org',
      counterpartyName: 'Test',
      promisedDate,
      promisedAmountCents: 10000,
      currency: 'RUB',
      status: status as any,
      source: 'call',
      contactName: 'Test',
      employeeId: 'user',
      createdBy: 'user',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    });

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-06-15T12:00:00'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('isPromiseNeedsCheck returns true for promise due today', () => {
      expect(isPromiseNeedsCheck(mockPromise('2024-06-15'))).toBe(true);
    });

    it('isPromiseNeedsCheck returns true for overdue promise', () => {
      expect(isPromiseNeedsCheck(mockPromise('2024-06-10'))).toBe(true);
    });

    it('isPromiseNeedsCheck returns false for future promise', () => {
      expect(isPromiseNeedsCheck(mockPromise('2024-06-20'))).toBe(false);
    });

    it('isPromiseNeedsCheck returns false for fulfilled promise', () => {
      expect(isPromiseNeedsCheck(mockPromise('2024-06-10', 'fulfilled'))).toBe(false);
    });

    it('promiseOverdueDays returns 0 for future promise', () => {
      expect(promiseOverdueDays(mockPromise('2024-06-20'))).toBe(0);
    });

    it('promiseOverdueDays returns 5 for promise 5 days overdue', () => {
      expect(promiseOverdueDays(mockPromise('2024-06-10'))).toBe(5);
    });
  });
});
