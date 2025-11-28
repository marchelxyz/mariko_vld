// Feature-sliced: сущность User  
// На первом этапе мы просто реэкспортируем существующий код,  
// чтобы можно было импортировать из "@entities/user" без изменений логики.

// Модель (типы) — берём из временного сервис-слоя (локальный путь)
export type { UserProfile, UserActivity } from "../services/database";

// Бизнес-логику (hooks) пока оставляем как есть
export { useProfile } from "./model";

// UI-компоненты, относящиеся к сущности пользователя
export { ProfileAvatar } from "./ui";
export { EditableField } from "@shared/ui"; 
