// ============================================================
// Экспорт адаптеров и регистрация в фабрике
// ============================================================

export * from './types';
export { MockOneCAdapter } from './mockAdapter';
export { CustomHttpAdapter } from './customHttpAdapter';

import { adapterFactory } from './types';
import { MockOneCAdapter } from './mockAdapter';
import { CustomHttpAdapter } from './customHttpAdapter';

// Регистрация встроенных адаптеров
adapterFactory.register(new MockOneCAdapter());
adapterFactory.register(new CustomHttpAdapter());
