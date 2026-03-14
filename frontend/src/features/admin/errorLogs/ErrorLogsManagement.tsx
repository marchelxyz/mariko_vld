import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCheck,
  Loader2,
  RotateCcw,
  Search,
  ShieldAlert,
} from "lucide-react";
import {
  adminServerApi,
  type AppErrorLogRecord,
  type AppErrorLogStatus,
} from "@shared/api/admin";
import { useAdmin } from "@shared/hooks";
import { Button, Input } from "@shared/ui";

type StatusFilter = "all" | AppErrorLogStatus;

const STATUS_LABELS: Record<AppErrorLogStatus, string> = {
  new: "Новая",
  resolved: "Решена",
};

const STATUS_CLASSES: Record<AppErrorLogStatus, string> = {
  new: "bg-amber-500/20 text-amber-100 border border-amber-400/20",
  resolved: "bg-emerald-500/20 text-emerald-100 border border-emerald-400/20",
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Супер-админ",
  admin: "Админ",
  manager: "Управляющий",
  restaurant_manager: "Менеджер ресторана",
  marketer: "Маркетолог",
  delivery_manager: "Менеджер доставки",
  user: "Пользователь",
};

function formatDateTime(value: string | null): string {
  if (!value) {
    return "Неизвестно";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildSearchText(log: AppErrorLogRecord): string {
  return [
    log.message,
    log.category,
    log.userName,
    log.userId,
    log.telegramId,
    log.vkId,
    log.pathname,
    log.role,
    log.platform,
    log.errorName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function renderRoleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

export function ErrorLogsManagement(): JSX.Element | null {
  const { isSuperAdmin } = useAdmin();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingLogId, setUpdatingLogId] = useState<string | null>(null);

  const {
    data,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["admin-error-logs"],
    queryFn: () => adminServerApi.getErrorLogs({ limit: 200 }),
    enabled: isSuperAdmin(),
  });

  const logs = data?.logs ?? [];
  const counts = data?.counts ?? { total: 0, new: 0, resolved: 0 };

  const filteredLogs = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return logs.filter((log) => {
      if (statusFilter !== "all" && log.status !== statusFilter) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }
      return buildSearchText(log).includes(normalizedSearch);
    });
  }, [logs, searchQuery, statusFilter]);

  const handleStatusChange = async (logId: string, status: AppErrorLogStatus) => {
    setUpdatingLogId(logId);
    try {
      await adminServerApi.updateErrorLogStatus(logId, status);
      await refetch();
    } catch (error) {
      console.error("Ошибка изменения статуса лога:", error);
      alert("Не удалось изменить статус ошибки");
    } finally {
      setUpdatingLogId(null);
    }
  };

  if (!isSuperAdmin()) {
    return null;
  }

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-white font-el-messiri text-2xl md:text-3xl font-bold">
            Ошибки приложения
          </h2>
          <p className="text-white/70 mt-1">
            Реестр пользовательских и административных ошибок с пометкой обработки
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-2" />}
          Обновить
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <p className="text-white/60 text-sm">Всего записей</p>
          <p className="text-white text-2xl font-bold mt-1">{counts.total}</p>
        </div>
        <div className="bg-amber-500/10 border border-amber-400/20 rounded-2xl p-4">
          <p className="text-amber-100/80 text-sm">Новые</p>
          <p className="text-amber-50 text-2xl font-bold mt-1">{counts.new}</p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-400/20 rounded-2xl p-4">
          <p className="text-emerald-100/80 text-sm">Решённые</p>
          <p className="text-emerald-50 text-2xl font-bold mt-1">{counts.resolved}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {[
            { value: "all" as StatusFilter, label: "Все" },
            { value: "new" as StatusFilter, label: "Новые" },
            { value: "resolved" as StatusFilter, label: "Решённые" },
          ].map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setStatusFilter(filter.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                statusFilter === filter.value
                  ? "bg-mariko-primary text-white"
                  : "bg-white/10 text-white/80 hover:bg-white/15"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none" />
          <Input
            type="text"
            placeholder="Поиск по сообщению, роли, странице"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full bg-white/10 border-white/20 text-white placeholder:text-white/60 pl-9"
          />
        </div>
      </div>

      <div className="space-y-3">
        {filteredLogs.map((log) => {
          const isPending = updatingLogId === log.id;
          return (
            <div key={log.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CLASSES[log.status]}`}>
                      {STATUS_LABELS[log.status]}
                    </span>
                    <span className="inline-flex rounded-full px-3 py-1 text-xs font-semibold bg-white/10 text-white/80">
                      {renderRoleLabel(log.role)}
                    </span>
                    {log.platform && (
                      <span className="inline-flex rounded-full px-3 py-1 text-xs font-semibold bg-white/10 text-white/70">
                        {log.platform}
                      </span>
                    )}
                    <span className="text-white/50 text-xs">{formatDateTime(log.createdAt)}</span>
                  </div>

                  <h3 className="text-white text-lg font-semibold mt-3 break-words">
                    {log.message}
                  </h3>

                  <div className="mt-3 grid gap-2 text-sm text-white/75 md:grid-cols-2">
                    <p>Категория: <span className="text-white">{log.category}</span></p>
                    <p>Пользователь: <span className="text-white">{log.userName ?? "Неизвестно"}</span></p>
                    <p>Роль: <span className="text-white">{renderRoleLabel(log.role)}</span></p>
                    <p>Страница: <span className="text-white break-all">{log.pathname ?? "Неизвестно"}</span></p>
                    {log.telegramId && <p>TG ID: <span className="text-white">{log.telegramId}</span></p>}
                    {log.vkId && <p>VK ID: <span className="text-white">{log.vkId}</span></p>}
                    {log.errorName && <p>Ошибка: <span className="text-white">{log.errorName}</span></p>}
                    {log.sessionId && <p>Сессия: <span className="text-white break-all">{log.sessionId}</span></p>}
                  </div>

                  {log.status === "resolved" && (
                    <p className="mt-3 text-sm text-emerald-100/80">
                      Решена: {formatDateTime(log.resolvedAt)}
                      {log.resolvedByTelegramId ? ` · супер-админ ${log.resolvedByTelegramId}` : ""}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {log.status === "new" ? (
                    <Button
                      type="button"
                      variant="default"
                      className="bg-emerald-600 hover:bg-emerald-600/90"
                      disabled={isPending}
                      onClick={() => void handleStatusChange(log.id, "resolved")}
                    >
                      <CheckCheck className="w-4 h-4 mr-2" />
                      Решена
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => void handleStatusChange(log.id, "new")}
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Вернуть в новые
                    </Button>
                  )}
                </div>
              </div>

              <details className="mt-4 group">
                <summary className="cursor-pointer list-none text-sm text-white/70 hover:text-white transition-colors">
                  Показать технические детали
                </summary>
                <div className="mt-3 space-y-3">
                  {log.errorStack && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-white/50 mb-2">Stack trace</p>
                      <pre className="whitespace-pre-wrap break-words rounded-xl bg-black/20 p-3 text-xs text-white/80 overflow-auto">
                        {log.errorStack}
                      </pre>
                    </div>
                  )}

                  <div>
                    <p className="text-xs uppercase tracking-wide text-white/50 mb-2">Payload</p>
                    <pre className="whitespace-pre-wrap break-words rounded-xl bg-black/20 p-3 text-xs text-white/80 overflow-auto">
                      {JSON.stringify(log.payload, null, 2)}
                    </pre>
                  </div>
                </div>
              </details>
            </div>
          );
        })}

        {!filteredLogs.length && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center text-white/70">
            <ShieldAlert className="w-8 h-8 mx-auto mb-3 opacity-70" />
            Ошибки по текущему фильтру не найдены
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-white/60 text-sm">
        <AlertTriangle className="w-4 h-4" />
        В журнал попадают runtime-ошибки, ошибки API и проблемные действия пользователей и админов.
      </div>
    </div>
  );
}

export default ErrorLogsManagement;
