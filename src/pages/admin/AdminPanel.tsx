/**
 * Главная страница админ-панели
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, UtensilsCrossed, Shield, ChevronRight } from 'lucide-react';
import { useAdmin } from '@/shared/hooks/useAdmin';
import { Header } from '@/widgets/header';
import { BottomNavigation } from '@/widgets/bottomNavigation';
import { CitiesManagement } from '@/features/admin/cities/CitiesManagement';
import { MenuManagement } from '@/features/admin/menu/MenuManagement';
import { RolesManagement } from '@/features/admin/roles/RolesManagement';
import { Button } from '@shared/ui';

type AdminSection = 'cities' | 'menu' | 'roles' | null;

/**
 * Админ-панель для управления ресторанами, меню и ролями
 */
export default function AdminPanel(): JSX.Element {
  const navigate = useNavigate();
  const { isAdmin, isLoading, userRole, userId, isSuperAdmin } = useAdmin();
  const [activeSection, setActiveSection] = useState<AdminSection>(null);

  // Проверка прав доступа
  if (isLoading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-white font-el-messiri text-xl">Загрузка...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-transparent overflow-hidden flex flex-col">
        <Header />
        <div className="flex-1 px-4 md:px-6 max-w-4xl mx-auto w-full flex items-center justify-center">
          <div className="bg-mariko-secondary rounded-[24px] p-12 text-center">
            <Shield className="w-16 h-16 text-white/30 mx-auto mb-4" />
            <h2 className="text-white font-el-messiri text-2xl font-bold mb-2">
              Доступ запрещен
            </h2>
            <p className="text-white/70 mb-6">
              У вас нет прав для доступа к админ-панели
            </p>
            <Button onClick={() => navigate('/')} variant="default">
              <ArrowLeft className="w-4 h-4 mr-2" />
              На главную
            </Button>
          </div>
        </div>
        <BottomNavigation currentPage="home" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent overflow-hidden flex flex-col">
      <Header />
      
      <div className="flex-1 px-4 md:px-6 max-w-7xl mx-auto w-full pb-28">
        {/* Заголовок */}
        <div className="mt-10 flex items-center gap-4 mb-8">
          {activeSection ? (
            <button
              onClick={() => setActiveSection(null)}
              className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          ) : (
            <button
              onClick={() => navigate('/')}
              className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-white font-el-messiri text-3xl md:text-4xl font-bold">
                Админ-панель
              </h1>
              {userId === 'demo_user' && (
                <span className="px-3 py-1 bg-yellow-500/20 border border-yellow-500/40 text-yellow-200 rounded-full text-sm font-medium">
                  🔧 DEV режим
                </span>
              )}
            </div>
            <p className="text-white/70 mt-1">
              Ваша роль: {userRole === 'super_admin' ? 'Супер-администратор' : 'Администратор'}
            </p>
          </div>
        </div>

        {/* Контент */}
        {!activeSection ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Управление городами */}
            <AdminCard
              icon={<Building2 className="w-8 h-8" />}
              title="Управление ресторанами"
              description="Добавляйте города и рестораны, активируйте и деактивируйте их"
              onClick={() => setActiveSection('cities')}
            />

            {/* Управление меню */}
            <AdminCard
              icon={<UtensilsCrossed className="w-8 h-8" />}
              title="Управление меню"
              description="Редактируйте меню ресторанов, добавляйте блюда и категории"
              onClick={() => setActiveSection('menu')}
            />

            {/* Управление ролями (только для супер-админа) */}
            {isSuperAdmin() && (
              <AdminCard
                icon={<Shield className="w-8 h-8" />}
                title="Управление ролями"
                description="Выдавайте админ-права сотрудникам ресторана"
                onClick={() => setActiveSection('roles')}
                highlighted
              />
            )}
          </div>
        ) : (
          <div>
            {activeSection === 'cities' && <CitiesManagement />}
            {activeSection === 'menu' && <MenuManagement />}
            {activeSection === 'roles' && <RolesManagement />}
          </div>
        )}
      </div>

      <BottomNavigation currentPage="admin" />
    </div>
  );
}

/**
 * Карточка раздела админ-панели
 */
interface AdminCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  highlighted?: boolean;
}

function AdminCard({ icon, title, description, onClick, highlighted }: AdminCardProps): JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`
        group relative overflow-hidden
        bg-mariko-secondary rounded-[24px] p-6
        hover:scale-105 transition-all duration-300
        text-left
        ${highlighted ? 'ring-2 ring-mariko-primary' : ''}
      `}
    >
      {/* Фоновый градиент при наведении */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/0 group-hover:from-white/5 group-hover:to-white/10 transition-all duration-300" />
      
      {/* Иконка */}
      <div className="relative mb-4 text-mariko-primary">
        {icon}
      </div>

      {/* Заголовок */}
      <h3 className="relative text-white font-el-messiri text-xl font-bold mb-2">
        {title}
      </h3>

      {/* Описание */}
      <p className="relative text-white/70 text-sm mb-4">
        {description}
      </p>

      {/* Стрелка */}
      <div className="relative flex items-center text-mariko-primary font-medium">
        <span>Открыть</span>
        <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
      </div>

      {highlighted && (
        <div className="absolute top-4 right-4 px-2 py-1 bg-mariko-primary rounded text-white text-xs font-bold">
          Только для вас
        </div>
      )}
    </button>
  );
}

