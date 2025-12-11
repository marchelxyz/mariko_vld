/**
 * Хук для работы с админ-панелью
 * Использует AdminContext для получения данных о ролях пользователя
 * Проверка ролей выполняется один раз за сеанс в AdminProvider
 */

import { useAdminContext } from "@/contexts/AdminContext";

/**
 * Хук для проверки прав администратора
 * Данные загружаются один раз за сеанс через AdminProvider
 */
export function useAdmin() {
  return useAdminContext();
}
