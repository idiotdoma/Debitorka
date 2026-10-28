import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function DemoModeWarning() {
  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center gap-2 text-sm">
        <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
        <span className="text-yellow-700 dark:text-yellow-300">
          <strong>Демонстрационный режим:</strong> Данные хранятся локально в браузере. 
          Для работы с реальными финансовыми данными требуется серверная часть с базой данных.
        </span>
      </div>
    </div>
  );
}
