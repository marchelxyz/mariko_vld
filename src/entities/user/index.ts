// Feature-sliced: сущность User  
// На первом этапе мы просто реэкспортируем существующий код,  
// чтобы можно было импортировать из "@entities/user" без изменений логики.

// Модель (типы) — берём из временного сервис-слоя
export type { UserProfile, UserActivity } from "@/services/database";

// Бизнес-логику (hooks) пока оставляем как есть
export { useProfile } from "./model/useProfile";

// UI-компоненты, относящиеся к сущности пользователя
export { ProfileAvatar } from "@/components/ProfileAvatar";
export { EditableField } from "@/components/EditableField"; 