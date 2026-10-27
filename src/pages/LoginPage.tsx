import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Eye, EyeOff, Building2 } from 'lucide-react';

export default function LoginPage() {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let result;
      if (isRegister) {
        if (!firstName.trim() || !orgName.trim()) {
          setError('Заполните все поля');
          setLoading(false);
          return;
        }
        result = await register(email, password, firstName, orgName);
      } else {
        result = await login(email, password);
      }

      if (!result.success) {
        setError(result.error || 'Ошибка');
      }
    } catch (err) {
      setError('Произошла ошибка. Попробуйте снова.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-600/30">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Дебиторка</h1>
          <p className="text-blue-200/70">Ежедневный контроль B2B-задолженности</p>
        </div>

        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-6">
            {isRegister ? 'Регистрация организации' : 'Вход в систему'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <>
                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-1">
                    Название организации
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-300/50" />
                    <input
                      type="text"
                      value={orgName}
                      onChange={e => setOrgName(e.target.value)}
                      placeholder="ООО «Ваша компания»"
                      className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-1">Ваше имя</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    placeholder="Иван"
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-blue-200 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@company.ru"
                required
                className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-200 mb-1">Пароль</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 pr-12 bg-white/5 border border-white/20 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-300/50 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 text-red-200 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-medium rounded-xl transition shadow-lg shadow-blue-600/30"
            >
              {loading ? 'Загрузка...' : isRegister ? 'Зарегистрировать' : 'Войти'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => { setIsRegister(!isRegister); setError(''); }}
              className="text-blue-300 hover:text-white text-sm transition"
            >
              {isRegister ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрировать организацию'}
            </button>
          </div>
        </div>

        {!isRegister && (
          <div className="mt-6 bg-white/5 backdrop-blur rounded-xl border border-white/10 p-4">
            <p className="text-xs text-blue-200/60 mb-2 font-medium">Демо-доступ:</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white/5 rounded-lg p-2">
                <p className="text-purple-300 font-medium">Владелец (Орг. А)</p>
                <p className="text-white/60">admin@alfa.ru</p>
                <p className="text-white/40">пароль: admin123</p>
              </div>
              <div className="bg-white/5 rounded-lg p-2">
                <p className="text-blue-300 font-medium">Руководитель (Орг. А)</p>
                <p className="text-white/60">manager@alfa.ru</p>
                <p className="text-white/40">пароль: manager123</p>
              </div>
              <div className="bg-white/5 rounded-lg p-2">
                <p className="text-green-300 font-medium">Финансист (Орг. А)</p>
                <p className="text-white/60">finance@alfa.ru</p>
                <p className="text-white/40">пароль: finance123</p>
              </div>
              <div className="bg-white/5 rounded-lg p-2">
                <p className="text-yellow-300 font-medium">Сотрудник (Орг. А)</p>
                <p className="text-white/60">employee@alfa.ru</p>
                <p className="text-white/40">пароль: employee123</p>
              </div>
              <div className="bg-white/5 rounded-lg p-2">
                <p className="text-purple-300 font-medium">Владелец (Орг. Б)</p>
                <p className="text-white/60">admin@beta.ru</p>
                <p className="text-white/40">пароль: admin123</p>
              </div>
              <div className="bg-white/5 rounded-lg p-2">
                <p className="text-gray-300 font-medium">Наблюдатель (Орг. Б)</p>
                <p className="text-white/60">viewer@beta.ru</p>
                <p className="text-white/40">пароль: viewer123</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
