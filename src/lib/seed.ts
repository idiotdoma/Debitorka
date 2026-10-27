// ============================================================
// Инициализация демо-данных
// ============================================================

import { Organization, User } from '../types/models';
import { hashPassword, generateId } from './utils';
import { orgStore, userStore, debtStore, teamStore } from './store';

export function initializeDemoData(): void {
  if (orgStore.getAll().length > 0) return;
  
  // Создаём организацию
  const org: Organization = {
    id: generateId('org'),
    name: 'ООО «Демо Компания»',
    timezone: 'Europe/Moscow',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  orgStore.create(org);
  
  // Создаём команду
  const team = {
    id: generateId('team'),
    organizationId: org.id,
    name: 'Отдел работы с задолженностью',
    description: 'Основная команда',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  teamStore.create(team);
  
  // Создаём владельца
  const owner: User = {
    id: generateId('user'),
    email: 'owner@demo.ru',
    passwordHash: hashPassword('owner123'),
    firstName: 'Иван',
    lastName: 'Владелец',
    organizationId: org.id,
    role: 'owner',
    teamId: team.id,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  userStore.create(owner);
  
  // Создаём руководителя
  const manager: User = {
    id: generateId('user'),
    email: 'manager@demo.ru',
    passwordHash: hashPassword('manager123'),
    firstName: 'Пётр',
    lastName: 'Руководитель',
    organizationId: org.id,
    role: 'manager',
    teamId: team.id,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  userStore.create(manager);
  
  // Обновляем команду — назначаем руководителя
  teamStore.update(team.id, { managerId: manager.id }, org.id, {
    userId: owner.id,
    organizationId: org.id,
    token: 'init',
    expiresAt: new Date().toISOString(),
  });
  
  // Создаём сотрудника
  const employee: User = {
    id: generateId('user'),
    email: 'employee@demo.ru',
    passwordHash: hashPassword('employee123'),
    firstName: 'Мария',
    lastName: 'Сотрудник',
    organizationId: org.id,
    role: 'employee',
    teamId: team.id,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  userStore.create(employee);
  
  // Создаём наблюдателя
  const viewer: User = {
    id: generateId('user'),
    email: 'viewer@demo.ru',
    passwordHash: hashPassword('viewer123'),
    firstName: 'Алексей',
    lastName: 'Наблюдатель',
    organizationId: org.id,
    role: 'viewer',
    teamId: team.id,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  userStore.create(viewer);
  
  // Создаём демо-задолженности
  const debts = [
    { counterparty: 'ООО «Клиент А»', amount: 15000000, daysOverdue: 45 },
    { counterparty: 'ИП Иванов И.И.', amount: 3400000, daysOverdue: 120 },
    { counterparty: 'АО «Партнёр»', amount: 28000000, daysOverdue: 15 },
    { counterparty: 'ООО «Заказчик»', amount: 5670000, daysOverdue: 200 },
    { counterparty: 'ЗАО «Покупатель»', amount: 8900000, daysOverdue: 0 },
  ];
  
  debts.forEach((debt, i) => {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() - debt.daysOverdue);
    
    debtStore.create({
      id: generateId('debt'),
      organizationId: org.id,
      counterpartyName: debt.counterparty,
      amountCents: debt.amount,
      dueDate: dueDate.toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
    });
  });
}
