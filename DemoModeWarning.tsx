import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function DemoModeWarning() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-yellow-200 text-xs">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>
            <strong>Демо-режим:</strong> Данные хранятся в браузере и не синхронизируются. 
            Не используйте реальные конфиденциальные данные.
          </span>
        </div>
        <button
          onClick={() => setIsVisible(false)}
          className="text-yellow-200/60 hover:text-yellow-200 transition flex-shrink-0"
          title="Скрыть предупреждение"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
