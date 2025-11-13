/**
 * Компонент управления ролями пользователей
 */

import { useState, useMemo } from 'react';
import { adminApi } from '@/shared/api/adminApi';
import { useAdmin } from '@/shared/hooks/useAdmin';
import { UserRole, Permission } from '@/shared/types/admin';
import { profileDB } from '@/services/database';
import { Shield, UserCheck, UserX, Search } from 'lucide-react';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@shared/ui';

interface UserWithRoleData {
  id: string;
  telegramId?: number;
  name: string;
  phone?: string;
  currentRole: UserRole;
}

/**
 * Компонент управления ролями пользователей
 */
export function RolesManagement(): JSX.Element {
  const { userId, isSuperAdmin } = useAdmin();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [newRole, setNewRole] = useState<UserRole>(UserRole.USER);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Получаем всех пользователей из базы данных
  const allUsers = useMemo(() => {
    const profiles = profileDB.getAllProfiles();
    
    return profiles.map((profile) => ({
      id: profile.id,
      telegramId: profile.telegramId,
      name: profile.name || `Пользователь ${profile.id}`,
      phone: profile.phone,
      currentRole: adminApi.getUserRole(profile.id),
    }));
  }, []);

  // Фильтрация пользователей
  const filteredUsers = useMemo(() => {
    if (!searchQuery) return allUsers;
    
    const query = searchQuery.toLowerCase();
    return allUsers.filter((user) =>
      user.name.toLowerCase().includes(query) ||
      user.id.includes(query) ||
      user.phone?.includes(query) ||
      user.telegramId?.toString().includes(query)
    );
  }, [allUsers, searchQuery]);

  // Группировка по ролям
  const usersByRole = useMemo(() => {
    const superAdmins = filteredUsers.filter((u) => u.currentRole === UserRole.SUPER_ADMIN);
    const admins = filteredUsers.filter((u) => u.currentRole === UserRole.ADMIN);
    const users = filteredUsers.filter((u) => u.currentRole === UserRole.USER);

    return { superAdmins, admins, users };
  }, [filteredUsers]);

  /**
   * Получить описание роли
   */
  const getRoleLabel = (role: UserRole): string => {
    switch (role) {
      case UserRole.SUPER_ADMIN:
        return 'Супер-администратор';
      case UserRole.ADMIN:
        return 'Администратор';
      case UserRole.USER:
        return 'Пользователь';
      default:
        return 'Неизвестная роль';
    }
  };

  /**
   * Получить цвет бейджа роли
   */
  const getRoleBadgeColor = (role: UserRole): string => {
    switch (role) {
      case UserRole.SUPER_ADMIN:
        return 'bg-red-500/20 text-red-200';
      case UserRole.ADMIN:
        return 'bg-mariko-primary/20 text-mariko-primary';
      case UserRole.USER:
        return 'bg-blue-500/20 text-blue-200';
      default:
        return 'bg-gray-500/20 text-gray-200';
    }
  };

  /**
   * Получить список прав роли
   */
  const getRolePermissions = (role: UserRole): string[] => {
    const permissions = adminApi.getUserPermissions('temp_user_with_role_' + role);
    
    return permissions.map((p) => {
      switch (p) {
        case Permission.MANAGE_CITIES:
          return 'Управление городами';
        case Permission.MANAGE_RESTAURANTS:
          return 'Управление ресторанами';
        case Permission.MANAGE_MENU:
          return 'Управление меню';
        case Permission.MANAGE_ROLES:
          return 'Управление ролями';
        case Permission.MANAGE_REVIEWS:
          return 'Управление отзывами';
        case Permission.MANAGE_USERS:
          return 'Управление пользователями';
        default:
          return p;
      }
    });
  };

  /**
   * Изменить роль пользователя
   */
  const handleChangeRole = () => {
    if (!selectedUserId || !isSuperAdmin()) {
      alert('Только супер-администратор может изменять роли');
      return;
    }

    const success = adminApi.setUserRole(selectedUserId, newRole, userId);
    
    if (success) {
      alert('Роль пользователя успешно изменена');
      setShowConfirmDialog(false);
      setSelectedUserId('');
      // Перезагружаем страницу для обновления данных
      window.location.reload();
    } else {
      alert('Ошибка изменения роли');
    }
  };

  // Проверяем права доступа
  if (!isSuperAdmin()) {
    return (
      <div className="bg-mariko-secondary rounded-[24px] p-12 text-center">
        <Shield className="w-12 h-12 text-white/30 mx-auto mb-4" />
        <h3 className="text-white font-el-messiri text-xl font-bold mb-2">
          Доступ запрещен
        </h3>
        <p className="text-white/70">
          Управление ролями доступно только супер-администратору
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Заголовок и поиск */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-white font-el-messiri text-2xl md:text-3xl font-bold">
            Управление ролями
          </h2>
          <p className="text-white/70 mt-1">
            Всего пользователей: {allUsers.length}
          </p>
        </div>

        <Input
          type="text"
          placeholder="Поиск по имени, ID или телефону..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full sm:w-64"
          icon={<Search className="w-4 h-4" />}
        />
      </div>

      {/* Информация о ролях */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-red-500/10 border border-red-500/20 rounded-[20px] p-4">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-5 h-5 text-red-400" />
            <h3 className="text-white font-el-messiri font-bold">Супер-администратор</h3>
          </div>
          <p className="text-white/70 text-sm mb-3">
            Полный доступ ко всем функциям системы
          </p>
          <div className="text-2xl font-bold text-red-400">
            {usersByRole.superAdmins.length}
          </div>
        </div>

        <div className="bg-mariko-primary/10 border border-mariko-primary/20 rounded-[20px] p-4">
          <div className="flex items-center gap-3 mb-2">
            <UserCheck className="w-5 h-5 text-mariko-primary" />
            <h3 className="text-white font-el-messiri font-bold">Администратор</h3>
          </div>
          <p className="text-white/70 text-sm mb-3">
            Управление содержимым, но не ролями
          </p>
          <div className="text-2xl font-bold text-mariko-primary">
            {usersByRole.admins.length}
          </div>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-[20px] p-4">
          <div className="flex items-center gap-3 mb-2">
            <UserX className="w-5 h-5 text-blue-400" />
            <h3 className="text-white font-el-messiri font-bold">Пользователь</h3>
          </div>
          <p className="text-white/70 text-sm mb-3">
            Обычные пользователи без админ-прав
          </p>
          <div className="text-2xl font-bold text-blue-400">
            {usersByRole.users.length}
          </div>
        </div>
      </div>

      {/* Список пользователей */}
      <div className="space-y-4">
        {/* Супер-администраторы */}
        {usersByRole.superAdmins.length > 0 && (
          <div>
            <h3 className="text-white font-el-messiri text-lg font-bold mb-3">
              Супер-администраторы
            </h3>
            <div className="space-y-2">
              {usersByRole.superAdmins.map((user) => (
                <UserRoleCard
                  key={user.id}
                  user={user}
                  onChangeRole={(newRole) => {
                    setSelectedUserId(user.id);
                    setNewRole(newRole);
                    setShowConfirmDialog(true);
                  }}
                  getRoleLabel={getRoleLabel}
                  getRoleBadgeColor={getRoleBadgeColor}
                  canEdit={user.id !== userId} // Нельзя изменить свою роль
                />
              ))}
            </div>
          </div>
        )}

        {/* Администраторы */}
        {usersByRole.admins.length > 0 && (
          <div>
            <h3 className="text-white font-el-messiri text-lg font-bold mb-3">
              Администраторы
            </h3>
            <div className="space-y-2">
              {usersByRole.admins.map((user) => (
                <UserRoleCard
                  key={user.id}
                  user={user}
                  onChangeRole={(newRole) => {
                    setSelectedUserId(user.id);
                    setNewRole(newRole);
                    setShowConfirmDialog(true);
                  }}
                  getRoleLabel={getRoleLabel}
                  getRoleBadgeColor={getRoleBadgeColor}
                  canEdit={true}
                />
              ))}
            </div>
          </div>
        )}

        {/* Обычные пользователи */}
        {usersByRole.users.length > 0 && (
          <div>
            <h3 className="text-white font-el-messiri text-lg font-bold mb-3">
              Пользователи
            </h3>
            <div className="space-y-2">
              {usersByRole.users.slice(0, 20).map((user) => (
                <UserRoleCard
                  key={user.id}
                  user={user}
                  onChangeRole={(newRole) => {
                    setSelectedUserId(user.id);
                    setNewRole(newRole);
                    setShowConfirmDialog(true);
                  }}
                  getRoleLabel={getRoleLabel}
                  getRoleBadgeColor={getRoleBadgeColor}
                  canEdit={true}
                />
              ))}
              {usersByRole.users.length > 20 && (
                <p className="text-white/50 text-sm text-center py-4">
                  Показано 20 из {usersByRole.users.length} пользователей
                </p>
              )}
            </div>
          </div>
        )}

        {filteredUsers.length === 0 && (
          <div className="bg-mariko-secondary rounded-[24px] p-12 text-center">
            <Search className="w-12 h-12 text-white/30 mx-auto mb-4" />
            <p className="text-white/70 font-el-messiri text-lg">
              Пользователи не найдены
            </p>
          </div>
        )}
      </div>

      {/* Диалог подтверждения изменения роли */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Изменить роль пользователя?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите изменить роль этого пользователя на "{getRoleLabel(newRole)}"?
              <br />
              <br />
              <strong>Права новой роли:</strong>
              <ul className="list-disc list-inside mt-2">
                {getRolePermissions(newRole).map((perm, idx) => (
                  <li key={idx}>{perm}</li>
                ))}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleChangeRole}>
              Изменить роль
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * Карточка пользователя с ролью
 */
interface UserRoleCardProps {
  user: UserWithRoleData;
  onChangeRole: (newRole: UserRole) => void;
  getRoleLabel: (role: UserRole) => string;
  getRoleBadgeColor: (role: UserRole) => string;
  canEdit: boolean;
}

function UserRoleCard({
  user,
  onChangeRole,
  getRoleLabel,
  getRoleBadgeColor,
  canEdit,
}: UserRoleCardProps): JSX.Element {
  return (
    <div className="bg-mariko-secondary rounded-xl p-4 flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="text-white font-medium truncate">{user.name}</h4>
          <span className={`px-2 py-1 rounded text-xs ${getRoleBadgeColor(user.currentRole)}`}>
            {getRoleLabel(user.currentRole)}
          </span>
        </div>
        <div className="text-white/60 text-sm">
          {user.phone && <p>Телефон: {user.phone}</p>}
          {user.telegramId && <p>Telegram ID: {user.telegramId}</p>}
          <p className="text-xs">ID: {user.id}</p>
        </div>
      </div>

      {canEdit && (
        <div className="flex gap-2">
          <Select
            value={user.currentRole}
            onValueChange={(value) => onChangeRole(value as UserRole)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UserRole.SUPER_ADMIN}>Супер-администратор</SelectItem>
              <SelectItem value={UserRole.ADMIN}>Администратор</SelectItem>
              <SelectItem value={UserRole.USER}>Пользователь</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

