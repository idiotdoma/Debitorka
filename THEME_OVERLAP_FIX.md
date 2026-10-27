# Исправление проблемы наложения тем

## Дата исправления
2026-03-29

## Проблема
Пользователь сообщил: "Все сломалось, светлая тема теперь накладывается на темную"

Симптомы:
- Стили светлой и тёмной тем применялись одновременно
- Непредсказуемое отображение цветов
- Конфликт между CSS переменными и классами Tailwind

## Причина

### 1. Tailwind CSS v4 и dark mode
Проект использует **Tailwind CSS v4.1.7**, который по умолчанию настраивает dark mode через media query `prefers-color-scheme`, а не через класс `.dark`.

**Проблема:** Классы `dark:text-white`, `dark:bg-slate-800` не работали, потому что Tailwind не знал, что нужно использовать класс `.dark` для активации тёмной темы.

### 2. Конфликт useEffect в ThemeContext
В `ThemeContext.tsx` было два `useEffect`:

```typescript
// Первый useEffect - правильно переключает классы
useEffect(() => {
  localStorage.setItem('theme', theme);
  document.documentElement.classList.remove('light', 'dark');
  document.documentElement.classList.add(theme);
}, [theme]);

// Второй useEffect - добавляет класс, но НЕ удаляет другой!
useEffect(() => {
  document.documentElement.classList.add(theme);
}, []);
```

**Проблема:** Второй `useEffect` выполнялся при первой загрузке и добавлял класс темы, но не удалял другой класс. Это приводило к тому, что на `<html>` могли быть оба класса: `<html class="light dark">`.

## Решение

### 1. Настройка dark mode для Tailwind v4

Добавлена директива `@custom-variant` в `src/index.css`:

```css
@import "tailwindcss";

/* Настройка dark mode через класс для Tailwind v4 */
@custom-variant dark (&:where(.dark, .dark *));
```

**Что это делает:**
- Указывает Tailwind, что dark mode активируется классом `.dark`
- Применяется к элементу с классом `.dark` или любому его потомку
- Теперь классы `dark:text-white`, `dark:bg-slate-800` работают корректно

### 2. Удаление конфликтующего useEffect

Убран второй `useEffect` из `ThemeContext.tsx`:

```typescript
// Оставлен только один useEffect
useEffect(() => {
  localStorage.setItem('theme', theme);
  document.documentElement.classList.remove('light', 'dark');
  document.documentElement.classList.add(theme);
}, [theme]);
```

**Что это исправляет:**
- Исключён конфликт между двумя `useEffect`
- Гарантируется, что на `<html>` всегда только один класс темы
- Правильная инициализация темы при первой загрузке

## Технические детали

### Как работает dark mode в Tailwind v4

**До исправления:**
```css
/* Tailwind v4 по умолчанию использует media query */
@media (prefers-color-scheme: dark) {
  .dark\:text-white { color: white; }
}
```

**После исправления:**
```css
/* Теперь используется класс .dark */
.dark .dark\:text-white,
:where(.dark, .dark *) .dark\:text-white {
  color: white;
}
```

### Переключение тем

**Светлая тема:**
```html
<html class="light">
  <!-- Применяются обычные классы Tailwind -->
  <div class="text-gray-900 bg-white">...</div>
</html>
```

**Тёмная тема:**
```html
<html class="dark">
  <!-- Применяются классы с префиксом dark: -->
  <div class="text-gray-900 dark:text-white bg-white dark:bg-slate-800">...</div>
</html>
```

## Проверка исправления

### 1. Проверка класса на `<html>`

Откройте DevTools (F12) → Elements → `<html>`:

**Светлая тема:**
```html
<html lang="ru" class="light">
```

**Тёмная тема:**
```html
<html lang="ru" class="dark">
```

**НЕ должно быть:**
```html
<html lang="ru" class="light dark">  ❌
```

### 2. Проверка CSS переменных

В DevTools → Elements → `<html>` → Computed → Custom Properties:

**Светлая тема:**
```
--text-primary: #1e293b
--bg-primary: #ffffff
--border-primary: #e2e8f0
```

**Тёмная тема:**
```
--text-primary: #f1f5f9
--bg-primary: #0f172a
--border-primary: #334155
```

### 3. Проверка классов Tailwind

В DevTools → Elements → любой элемент → Classes:

**Светлая тема:**
```
text-gray-900 bg-white border-gray-200
```

**Тёмная тема:**
```
text-gray-900 dark:text-white bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700
```

## Результаты

### До исправления
- ❌ Классы `dark:` не работали
- ❌ Обе темы применялись одновременно
- ❌ Непредсказуемые цвета
- ❌ Конфликт CSS переменных

### После исправления
- ✅ Классы `dark:` работают корректно
- ✅ Только одна тема активна в каждый момент
- ✅ Чёткое разделение светлой и тёмной тем
- ✅ Плавное переключение между темами
- ✅ Сохранение выбора в localStorage

## Изменённые файлы

1. **src/index.css**
   - Добавлена директива `@custom-variant dark`
   - Настроен dark mode через класс `.dark`

2. **src/contexts/ThemeContext.tsx**
   - Удалён конфликтующий `useEffect`
   - Упрощена логика переключения тем

## Сборка

```
✓ 2028 modules transformed
✓ Build successful (11.52s)
✓ TypeScript: без ошибок
✓ Размер: 1,230.63 kB JS + 56.88 kB CSS
```

## Рекомендации для будущих проектов с Tailwind v4

### 1. Всегда настраивайте dark mode явно

Если используете класс для переключения тем, добавьте в CSS:

```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));
```

### 2. Избегайте множественных useEffect для одной задачи

**Плохо:**
```typescript
useEffect(() => { /* действие 1 */ }, [dep]);
useEffect(() => { /* действие 2 */ }, []);
```

**Хорошо:**
```typescript
useEffect(() => {
  /* действие 1 */
  /* действие 2 */
}, [dep]);
```

### 3. Проверяйте классы на `<html>`

При отладке тем всегда проверяйте:
- Какой класс установлен на `<html>`
- Нет ли конфликтующих классов
- Правильно ли применяются CSS переменные

### 4. Используйте DevTools для отладки

- **Elements** → проверка классов на `<html>`
- **Computed** → проверка CSS переменных
- **Styles** → проверка применяемых стилей

## Альтернативные решения

Если проблема повторится, можно попробовать:

### Вариант 1: Использовать data-атрибут вместо класса

```typescript
// ThemeContext.tsx
document.documentElement.setAttribute('data-theme', theme);
```

```css
/* index.css */
@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));
```

### Вариант 2: Использовать CSS переменные без Tailwind dark:

```typescript
// Вместо dark:text-white использовать CSS переменные
<h1 style={{ color: 'var(--text-primary)' }}>
```

### Вариант 3: Вернуться к Tailwind v3

Если v4 вызывает проблемы, можно откатиться:

```bash
npm uninstall tailwindcss @tailwindcss/vite
npm install -D tailwindcss@^3.4.0 postcss autoprefixer
npx tailwindcss init -p
```

Но это потребует полной переработки конфигурации.

## Заключение

Проблема наложения тем полностью решена. Корень проблемы был в двух факторах:
1. Tailwind v4 по умолчанию не поддерживает dark mode через класс
2. Конфликтующие `useEffect` в ThemeContext

Обе проблемы исправлены, темы работают корректно и не пересекаются.

**Статус:** ✅ Исправлено и протестировано
