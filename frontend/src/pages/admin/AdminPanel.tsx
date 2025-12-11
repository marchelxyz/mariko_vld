/**
 * Главная страница админ-панели
 */

import { ArrowLeft, Building2, UtensilsCrossed, Shield, ChevronRight, Truck, Megaphone, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNavigation, Header } from "@shared/ui/widgets";
import { useAdmin } from "@shared/hooks";
import { Permission, UserRole } from "@shared/types";
import { Button } from "@shared/ui";

const CitiesManagementLazy = lazy(() =>
  import("@features/admin").then((module) => ({
    default: module.CitiesManagement,
  })),
);
const MenuManagementLazy = lazy(() =>
  import("@features/admin").then((module) => ({
    default: module.MenuManagement,
  })),
);
const RolesManagementLazy = lazy(() =>
  import("@features/admin").then((module) => ({
    default: module.RolesManagement,
  })),
);
const DeliveryManagementLazy = lazy(() =>
  import("@features/admin").then((module) => ({
    default: module.DeliveryManagement,
  })),
);
const PromotionsManagementLazy = lazy(() =>
  import("@features/admin").then((module) => ({
    default: module.PromotionsManagement,
  })),
);
const RecommendedDishesManagementLazy = lazy(() =>
  import("@features/admin").then((module) => ({
    default: module.RecommendedDishesManagement,
  })),
);

type AdminSection = 'cities' | 'menu' | 'roles' | 'deliveries' | 'promotions' | 'recommended-dishes' | null;

const SectionLoader = () => (
  <div className="min-h-[40vh] flex items-center justify-center">
    <div className="text-white/80 font-el-messiri text-lg animate-pulse">Загрузка раздела...</div>
  </div>
);

/**
 * Админ-панель для управления ресторанами, меню и ролями
 */
export default function AdminPanel(): JSX.Element {
  const navigate = useNavigate();
  const { isAdmin, isLoading, userRole, hasPermission } = useAdmin();
  const [activeSection, setActiveSection] = useState<AdminSection>(null);

  const availableSections = useMemo(
    () =>
      [
        {
          key: 'cities' as AdminSection,
          icon: <Building2 className="w-8 h-8" />,
          title: "Управление ресторанами",
          description: "Добавляйте города и рестораны, активируйте и деактивируйте их",
          permission: Permission.MANAGE_RESTAURANTS,
        },
        {
          key: 'menu' as AdminSection,
          icon: <UtensilsCrossed className="w-8 h-8" />,
          title: "Управление меню",
          description: "Редактируйте меню ресторанов, добавляйте блюда и категории",
          permission: Permission.MANAGE_MENU,
        },
        {
          key: 'deliveries' as AdminSection,
          icon: <Truck className="w-8 h-8" />,
          title: "Управление доставками",
          description: "Следите за заказами, меняйте статусы и детали доставки",
          permission: Permission.MANAGE_DELIVERIES,
        },
        {
          key: 'promotions' as AdminSection,
          icon: <Megaphone className="w-8 h-8" />,
          title: "Управление акциями",
          description: "Заполняйте карточки для карусели на главной",
          permission: Permission.MANAGE_PROMOTIONS,
        },
        {
          key: 'recommended-dishes' as AdminSection,
          icon: <Sparkles className="w-8 h-8" />,
          title: "Рекомендуем попробовать",
          description: "Выберите блюда для раздела рекомендаций на главной",
          permission: Permission.MANAGE_PROMOTIONS,
        },
        {
          key: 'roles' as AdminSection,
          icon: <Shield className="w-8 h-8" />,
          title: "Управление ролями",
          description: "Выдавайте админ-права сотрудникам ресторана",
          permission: Permission.MANAGE_ROLES,
        },
      ].filter((section) => hasPermission(section.permission)),
    [hasPermission],
  );

  useEffect(() => {
    if (activeSection && !availableSections.some((section) => section.key === activeSection)) {
      setActiveSection(null);
    }
  }, [activeSection, availableSections]);

  const roleLabel = (() => {
    switch (userRole) {
      case UserRole.SUPER_ADMIN:
        return 'Супер-админ';
      case UserRole.ADMIN:
        return 'Админ';
      case UserRole.MANAGER:
        return 'Управляющий';
      case UserRole.RESTAURANT_MANAGER:
        return 'Менеджер ресторана';
      case UserRole.MARKETER:
        return 'Маркетолог';
      case UserRole.DELIVERY_MANAGER:
        return 'Менеджер по доставке';
      default:
        return 'Пользователь';
    }
  })();

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
      
      <div className="flex-1 px-3 md:px-6 max-w-7xl mx-auto w-full pb-24 md:pb-28">
        {/* Заголовок */}
        <div className="mt-6 md:mt-10 flex items-center gap-3 md:gap-4 mb-6 md:mb-8">
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
          <div className="flex-1 min-w-0">
            <h1 className="text-white font-el-messiri text-2xl md:text-3xl lg:text-4xl font-bold truncate">
              Админ-панель
            </h1>
            <p className="text-white/70 text-sm md:text-base mt-1">
              {roleLabel}
            </p>
          </div>
        </div>

        {/* Контент */}
        {!activeSection ? (
          <div className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-3">
            {availableSections.map((section) => (
              <AdminCard
                key={section.key}
                icon={section.icon}
                title={section.title}
                description={section.description}
                onClick={() => setActiveSection(section.key)}
              />
            ))}
            {!availableSections.length && (
              <div className="col-span-full bg-white/5 border border-white/10 rounded-2xl p-6 text-center text-white/70">
                Нет доступных разделов. Обратитесь к администратору для получения доступа.
              </div>
            )}
          </div>
        ) : (
          <div>
            {activeSection === 'cities' && (
              <Suspense fallback={<SectionLoader />}>
                <CitiesManagementLazy />
              </Suspense>
            )}
            {activeSection === 'menu' && (
              <Suspense fallback={<SectionLoader />}>
                <MenuManagementLazy />
              </Suspense>
            )}
            {activeSection === 'deliveries' && (
              <Suspense fallback={<SectionLoader />}>
                <DeliveryManagementLazy />
              </Suspense>
            )}
            {activeSection === 'promotions' && (
              <Suspense fallback={<SectionLoader />}>
                <PromotionsManagementLazy />
              </Suspense>
            )}
            {activeSection === 'recommended-dishes' && (
              <Suspense fallback={<SectionLoader />}>
                <RecommendedDishesManagementLazy />
              </Suspense>
            )}
            {activeSection === 'roles' && (
              <Suspense fallback={<SectionLoader />}>
                <RolesManagementLazy />
              </Suspense>
            )}
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
}

function AdminCard({ icon, title, description, onClick }: AdminCardProps): JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`
        group relative overflow-hidden
        bg-mariko-secondary rounded-2xl md:rounded-[24px] p-4 md:p-6
        active:scale-95 md:hover:scale-105 transition-all duration-300
        text-left
      `}
    >
      {/* Фоновый градиент при наведении */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/0 group-hover:from-white/5 group-hover:to-white/10 transition-all duration-300" />
      
      {/* Иконка */}
      <div className="relative mb-3 md:mb-4 text-mariko-primary scale-90 md:scale-100">
        {icon}
      </div>

      {/* Заголовок */}
      <h3 className="relative text-white font-el-messiri text-lg md:text-xl font-bold mb-1 md:mb-2">
        {title}
      </h3>

      {/* Описание */}
      <p className="relative text-white/70 text-xs md:text-sm mb-3 md:mb-4">
        {description}
      </p>

      {/* Стрелка */}
      <div className="relative flex items-center text-mariko-primary font-medium text-sm">
        <span>Открыть</span>
        <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
      </div>
    </button>
  );
}
