# Интеграция серверной части с Supabase

## 📋 Обзор

Серверная часть реализована с использованием:
- **Supabase** (PostgreSQL + Auth + RLS)
- **23 таблицы** для всех сущностей
- **Row Level Security** для безопасного разграничения доступа
- **RPC функции** для сложных операций
- **Views** для аналитики и расчетов

## ✅ Что уже сделано

### 1. Миграция базы данных
Файл: `debitorka_backend_migration_20261028000100.sql`

Содержит:
- Все таблицы (profiles, organizations, teams, debts, tasks, etc.)
- RLS политики для каждой таблицы
- RPC функции для бизнес-логики
- Триггеры для автоматического аудита
- Views для аналитики

### 2. API клиент для Supabase
Файл: `src/lib/supabase.ts`

Содержит:
- Инициализацию клиента Supabase
- TypeScript типы для всех моделей
- Вспомогательные функции для работы с API
- Функции для получения данных (debts, tasks, counterparties, etc.)
- Функции для создания/обновления данных

### 3. Конфигурация окружения
Файл: `.env.example`

```env
VITE_SUPABASE_URL=your-project-url.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Типы для Vite
Файл: `src/vite-env.d.ts`

## 🚀 Как настроить Supabase

### Шаг 1: Создайте проект в Supabase

1. Перейдите на https://app.supabase.com
2. Нажмите "New Project"
3. Заполните:
   - **Name**: Debitorka (или любое другое)
   - **Database Password**: сложный пароль (сохраните его!)
   - **Region**: выберите ближайший к вам
   - **Pricing Plan**: Free (для начала)

### Шаг 2: Примените миграцию

1. В Supabase Dashboard перейдите в **SQL Editor**
2. Нажмите "New Query"
3. Скопируйте содержимое файла `debitorka_backend_migration_20261028000100.sql`
4. Вставьте в редактор
5. Нажмите "Run" (Ctrl+Enter)

⚠️ **Важно**: Миграция создаст все таблицы, RLS политики, функции и триггеры. Это займет несколько секунд.

### Шаг 3: Получите API ключи

1. Перейдите в **Settings** → **API**
2. Скопируйте:
   - **Project URL** (например: `https://abcdefg.supabase.co`)
   - **anon public key** (длинная строка, начинается с `eyJ...`)

### Шаг 4: Настройте переменные окружения

1. Скопируйте `.env.example` в `.env`:
```bash
cp .env.example .env
```

2. Заполните `.env`:
```env
VITE_SUPABASE_URL=https://abcdefg.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

⚠️ **Никогда не коммитьте `.env` в git!**

### Шаг 5: Установите зависимости

```bash
npm install @supabase/supabase-js
```

### Шаг 6: Запустите проект

```bash
npm run dev
```

## 🔄 Что нужно обновить в клиентском коде

### Проблема

Текущий клиентский код использует `localStorage` для хранения данных. Новый AuthContext работает с Supabase, но все страницы все еще используют старый интерфейс.

### Решение

Нужно обновить все страницы для работы с новым AuthContext.

#### Старый интерфейс (localStorage):
```typescript
const { session, organization, user } = useAuth();
// session.organizationId, user.role, etc.
```

#### Новый интерфейс (Supabase):
```typescript
const { user, profile, currentOrganization, currentMembership } = useAuth();
// currentOrganization.id, currentMembership.role, etc.
```

### Пример обновления страницы

**Было (DashboardPage.tsx):**
```typescript
export default function DashboardPage() {
  const { session, organization, user } = useAuth();
  
  const data = useMemo(() => {
    if (!session || !organization || !user) return null;
    
    const debts = debtStore.getAll(organization.id, session);
    // ...
  }, [session, organization, user]);
}
```

**Стало (DashboardPage.tsx):**
```typescript
import { getDebts, getDebtAnalytics } from '../lib/supabase';

export default function DashboardPage() {
  const { user, currentOrganization } = useAuth();
  const [debts, setDebts] = useState([]);
  const [analytics, setAnalytics] = useState([]);
  
  useEffect(() => {
    if (!currentOrganization) return;
    
    async function loadData() {
      const debtsData = await getDebts(currentOrganization.id);
      const analyticsData = await getDebtAnalytics(currentOrganization.id);
      setDebts(debtsData);
      setAnalytics(analyticsData);
    }
    
    loadData();
  }, [currentOrganization]);
  
  // ...
}
```

## 📝 Список файлов для обновления

### Критические (обязательно):

1. **src/pages/LoginPage.tsx**
   - Обновить форму входа для работы с Supabase Auth
   - Добавить регистрацию через Supabase

2. **src/pages/DashboardPage.tsx**
   - Заменить `debtStore.getAll()` на `getDebts()`
   - Использовать `currentOrganization` вместо `organization`

3. **src/pages/DebtListPage.tsx**
   - Заменить localStorage вызовы на Supabase API
   - Добавить пагинацию через Supabase

4. **src/pages/TasksPage.tsx**
   - Заменить `taskStore` на Supabase API
   - Использовать `createTask()`, `updateTask()`

5. **src/pages/ImportPage.tsx**
   - Использовать `commitManualImport()` RPC функцию
   - Обновить обработку ошибок

6. **src/components/Layout.tsx**
   - Обновить отображение пользователя (profile вместо user)
   - Добавить переключатель организаций

### Важные (рекомендуется):

7. **src/pages/FinancialAnalyticsPage.tsx**
   - Использовать `getDebtAnalytics()`, `getDebtAging()`
   
8. **src/pages/PaymentCalendarPage.tsx**
   - Заменить вызовы store на Supabase API

9. **src/pages/CollectionPrioritiesPage.tsx**
   - Использовать `getDebtByCounterparty()`

10. **src/pages/ReportsPage.tsx**
    - Обновить все вызовы store на Supabase API

11. **src/pages/CompanyManagementPage.tsx**
    - Использовать RPC функции для управления пользователями

12. **src/pages/UsersPage.tsx**
    - Использовать `createInvitation()` RPC

13. **src/pages/ProfilePage.tsx**
    - Обновить для работы с profile вместо user

14. **src/pages/NotificationCenter.tsx**
    - Использовать `getNotifications()`, `markNotificationRead()`

### Менее критические:

15. **src/pages/ActionsPage.tsx**
16. **src/pages/AIAssistantPage.tsx**
17. **src/pages/DataQualityPage.tsx**
18. **src/pages/HistoryPage.tsx**
19. **src/pages/MyTasksPage.tsx**
20. **src/pages/SettingsPage.tsx**
21. **src/pages/CounterpartyNotesPage.tsx**
22. **src/pages/ManagerDashboardPage.tsx**
23. **src/pages/FinanceDashboardPage.tsx**

## 🎯 Ключевые изменения в AuthContext

### Старый AuthContext (localStorage):
```typescript
interface AuthContextType {
  user: User | null;  // Локальный объект
  organization: Organization | null;
  session: AuthSession | null;
  login: (email, password) => Promise<...>;
  register: (email, password, name, orgName) => Promise<...>;
  logout: () => void;
}
```

### Новый AuthContext (Supabase):
```typescript
interface AuthContextType {
  user: User | null;  // Supabase User
  profile: Profile | null;  // Дополнительный профиль
  organizations: OrganizationMembership[];  // Список организаций
  currentOrganization: Organization | null;  // Текущая организация
  currentMembership: OrganizationMembership | null;  // Текущее членство
  login: (email, password) => Promise<...>;
  register: (email, password, fullName) => Promise<...>;
  logout: () => Promise<void>;
  switchOrganization: (orgId: string) => void;  // Переключение между организациями
}
```

## 🔐 Безопасность

### Что обеспечивает Supabase:

1. **Аутентификация**
   - JWT токены
   - Автоматическое обновление сессии
   - Защита от CSRF

2. **Авторизация (RLS)**
   - Каждая строка проверяется на уровне БД
   - Пользователь видит только данные своей организации
   - Роли определяют доступ к операциям

3. **Защита данных**
   - Секреты хранятся только на сервере
   - API ключи не попадают в клиентский код
   - Валидация на уровне БД

### Роли и права:

| Роль | Чтение | Запись | Управление |
|------|--------|--------|------------|
| owner | ✅ Все | ✅ Все | ✅ Все |
| admin | ✅ Все | ✅ Все | ⚠️ Без owner |
| manager | ✅ Команда | ✅ Команда | ⚠️ Команда |
| finance | ✅ Финансы | ✅ Финансы | ❌ |
| employee | ✅ Свои | ✅ Свои | ❌ |
| viewer | ✅ Чтение | ❌ | ❌ |

## 🧪 Тестирование

### Локальное тестирование:

1. Создайте тестовый проект в Supabase
2. Примените миграцию
3. Создайте тестового пользователя через Supabase Dashboard
4. Настройте `.env` с тестовыми ключами
5. Запустите `npm run dev`

### Проверка функциональности:

- [ ] Регистрация нового пользователя
- [ ] Вход в систему
- [ ] Создание организации
- [ ] Импорт данных
- [ ] Просмотр задолженностей
- [ ] Создание задач
- [ ] Переключение между организациями
- [ ] Выход из системы

## 📚 Дополнительные ресурсы

### Документация Supabase:
- https://supabase.com/docs
- https://supabase.com/docs/guides/auth
- https://supabase.com/docs/guides/database

### RLS Policies:
- https://supabase.com/docs/guides/auth/row-level-security

### RPC Functions:
- https://supabase.com/docs/guides/database/functions

## ⚠️ Известные ограничения

1. **localStorage все еще используется** для некоторых настроек (тема, последняя организация)
2. **Старый код не удален** - он все еще в репозитории, но не используется
3. **Не все страницы обновлены** - требуется ручное обновление
4. **Тесты не обновлены** - старые тесты используют localStorage

## 🎯 Следующие шаги

### Приоритет 1: Критические страницы
1. Обновить LoginPage.tsx
2. Обновить DashboardPage.tsx
3. Обновить DebtListPage.tsx
4. Обновить ImportPage.tsx

### Приоритет 2: Важные страницы
5. Обновить TasksPage.tsx
6. Обновить FinancialAnalyticsPage.tsx
7. Обновить PaymentCalendarPage.tsx
8. Обновить Layout.tsx

### Приоритет 3: Остальные страницы
9. Обновить все остальные страницы
10. Удалить старый код (store.ts, старый AuthContext)
11. Обновить тесты
12. Обновить документацию

## 💡 Рекомендации

1. **Не удаляйте старый код сразу** - делайте это постепенно после обновления всех страниц
2. **Тестируйте каждую страницу** после обновления
3. **Используйте TypeScript** для проверки типов
4. **Коммитьте часто** - после обновления каждой страницы
5. **Создайте backup** перед началом обновления

## 🆘 Поддержка

Если возникнут проблемы:
1. Проверьте логи в консоли браузера
2. Проверьте логи в Supabase Dashboard → Logs
3. Убедитесь, что RLS политики применены
4. Проверьте, что API ключи правильные
5. Проверьте, что миграция выполнена успешно

---

**Статус**: ✅ Серверная часть готова, требуется обновление клиентского кода

**Прогресс**: 10% (создана инфраструктура, нужно обновить страницы)

**Время на завершение**: ~4-6 часов для обновления всех страниц
