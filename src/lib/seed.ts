// ============================================================
// Инициализация демо-данных — Этап 2
// ============================================================

import { Organization, User, DebtRecord } from '../types/models';
import { DEMO_ORG_A, DEMO_ORG_B } from './constants';
import { hashPassword, generateId, calculateOverdueDays, categorizeDebt, generateDocumentKey } from './calculations';
import { orgStore, userStore, debtStore, resetAllData } from './store';

export function initializeDemoData(): void {
  // Миграция: если есть старые данные без новых полей — сбрасываем
  const existingOrgs = orgStore.getAll();
  if (existingOrgs.length > 0) {
    const hasOldFormat = existingOrgs.some(o => !('timezone' in o) || !('staleDataThresholdHours' in o));
    if (hasOldFormat) {
      // Сбрасываем все данные для чистой миграции
      resetAllData();
    }
  }
  
  if (orgStore.getAll().length > 0) return;
  
  const orgA: Organization = {
    id: DEMO_ORG_A.id,
    name: DEMO_ORG_A.name,
    timezone: DEMO_ORG_A.timezone,
    staleDataThresholdHours: DEMO_ORG_A.staleDataThresholdHours,
    createdAt: new Date().toISOString(),
  };
  
  const orgB: Organization = {
    id: DEMO_ORG_B.id,
    name: DEMO_ORG_B.name,
    timezone: DEMO_ORG_B.timezone,
    staleDataThresholdHours: DEMO_ORG_B.staleDataThresholdHours,
    createdAt: new Date().toISOString(),
  };
  
  orgStore.create(orgA);
  orgStore.create(orgB);
  
  const users: User[] = [
    {
      id: generateId('user'),
      email: 'admin@alfa.ru',
      passwordHash: hashPassword('admin123'),
      name: 'Иванов Иван',
      firstName: 'Иванов',
      lastName: 'Иван',
      organizationId: orgA.id,
      role: 'owner',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: generateId('user'),
      email: 'manager@alfa.ru',
      passwordHash: hashPassword('manager123'),
      name: 'Петрова Мария',
      firstName: 'Петрова',
      lastName: 'Мария',
      organizationId: orgA.id,
      role: 'manager',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: generateId('user'),
      email: 'finance@alfa.ru',
      passwordHash: hashPassword('finance123'),
      name: 'Смирнов Дмитрий',
      firstName: 'Смирнов',
      lastName: 'Дмитрий',
      organizationId: orgA.id,
      role: 'finance',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: generateId('user'),
      email: 'employee@alfa.ru',
      passwordHash: hashPassword('employee123'),
      name: 'Сидоров Алексей',
      firstName: 'Сидоров',
      lastName: 'Алексей',
      organizationId: orgA.id,
      role: 'employee',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: generateId('user'),
      email: 'admin@beta.ru',
      passwordHash: hashPassword('admin123'),
      name: 'Козлова Елена',
      firstName: 'Козлова',
      lastName: 'Елена',
      organizationId: orgB.id,
      role: 'owner',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: generateId('user'),
      email: 'viewer@beta.ru',
      passwordHash: hashPassword('viewer123'),
      name: 'Новиков Петр',
      firstName: 'Новиков',
      lastName: 'Петр',
      organizationId: orgB.id,
      role: 'viewer',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
  
  users.forEach(user => userStore.create(user));
  
  // Создаём демо-данные задолженности для Org A
  const now = new Date();
  const demoDebtsA = createDemoDebts(orgA.id, [
    { name: 'ООО «СтройМонтаж»', amountCents: 125000000, daysOverdue: 45, docNo: 'СЧ-001/24' },
    { name: 'ИП Козлов А.В.', amountCents: 34000000, daysOverdue: 120, docNo: 'СЧ-015/24' },
    { name: 'АО «ТехноСервис»', amountCents: 280000000, daysOverdue: 15, docNo: 'СЧ-042/24' },
    { name: 'ООО «ЛогистикПро»', amountCents: 56700000, daysOverdue: 200, docNo: 'СЧ-008/24' },
    { name: 'ЗАО «МегаТорг»', amountCents: 89000000, daysOverdue: 0, docNo: 'СЧ-055/24' },
    { name: 'ООО «ФудСервис»', amountCents: 15600000, daysOverdue: 60, docNo: 'СЧ-023/24' },
    { name: 'ИП Новиков С.П.', amountCents: 450000000, daysOverdue: 95, docNo: 'СЧ-011/24' },
    { name: 'ООО «АвтоКомплект»', amountCents: 78000000, daysOverdue: 5, docNo: 'СЧ-067/24' },
    { name: 'ООО «Без срока»', amountCents: 19000000, daysOverdue: null, docNo: 'СЧ-077/24' },
  ]);
  
  demoDebtsA.forEach(debt => debtStore.create(debt));
  
  // Создаём демо-данные для Org B
  const demoDebtsB = createDemoDebts(orgB.id, [
    { name: 'ООО «ПромИнвест»', amountCents: 320000000, daysOverdue: 30, docNo: 'АКТ-101' },
    { name: 'АО «СеверТранс»', amountCents: 110000000, daysOverdue: 150, docNo: 'АКТ-087' },
    { name: 'ООО «ГринТех»', amountCents: 45000000, daysOverdue: 0, docNo: 'АКТ-120' },
    { name: 'ИП Смирнова Е.К.', amountCents: 67000000, daysOverdue: 75, docNo: 'АКТ-095' },
  ]);
  
  demoDebtsB.forEach(debt => debtStore.create(debt));
}

function createDemoDebts(orgId: string, items: { name: string; amountCents: number; daysOverdue: number | null; docNo: string }[]): DebtRecord[] {
  const now = new Date();
  
  return items.map((item, i) => {
    let dueDate: string | undefined;
    let overdueDays: number | null;
    
    if (item.daysOverdue !== null) {
      const due = new Date(now);
      due.setDate(due.getDate() - item.daysOverdue);
      dueDate = due.toISOString().split('T')[0];
      overdueDays = calculateOverdueDays(dueDate);
    } else {
      dueDate = undefined;
      overdueDays = null;
    }
    
    const docDate = new Date(now);
    docDate.setDate(docDate.getDate() - (item.daysOverdue || 0) - 30);
    
    const category = categorizeDebt(overdueDays);
    const documentKey = generateDocumentKey(item.name, item.docNo);
    
    return {
      id: generateId('debt'),
      organizationId: orgId,
      importBatchId: 'seed-batch',
      documentKey,
      counterpartyName: item.name,
      counterpartyINN: `${1000000000 + Math.floor(Math.random() * 9000000000)}`,
      docNumber: item.docNo,
      docDate: docDate.toISOString().split('T')[0],
      dueDate,
      amountCents: item.amountCents,
      currency: 'RUB',
      category,
      overdueDays,
      lastSourceUpdate: now.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
  });
}
