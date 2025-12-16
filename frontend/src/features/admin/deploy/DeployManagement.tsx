/**
 * Компонент управления деплоем на Timeweb
 */

import { Rocket, Settings, Search, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { adminServerApi } from "@shared/api/admin";
import { useAdmin } from "@shared/hooks";
import { UserRole } from "@shared/types";
import { logger } from "@/lib/logger";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@shared/ui";

type DeployAction = 'frontend' | 'nginx' | 'diagnose' | null;

export function DeployManagement(): JSX.Element {
  const { isSuperAdmin, userRole } = useAdmin();
  const [loading, setLoading] = useState<DeployAction>(null);
  const [output, setOutput] = useState<string>('');
  const [error, setError] = useState<string>('');

  // Только super_admin может деплоить
  if (!isSuperAdmin() && userRole !== UserRole.SUPER_ADMIN) {
    return (
      <div className="p-4">
        <Card>
          <CardHeader>
            <CardTitle>Доступ запрещён</CardTitle>
            <CardDescription>
              Только супер-администраторы могут управлять деплоем.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleDeploy = async (action: DeployAction) => {
    if (!action) return;

    setLoading(action);
    setError('');
    setOutput('');

    try {
      let result;
      switch (action) {
        case 'frontend':
          result = await adminServerApi.deployFrontend();
          break;
        case 'nginx':
          result = await adminServerApi.setupNginx();
          break;
        case 'diagnose':
          result = await adminServerApi.diagnoseTimeweb();
          break;
        default:
          return;
      }

      if (result.success) {
        setOutput(result.output || result.message || 'Операция выполнена успешно');
        logger.info('deploy', `Деплой ${action} завершён`, { output: result.output });
      } else {
        setError(result.message || 'Ошибка выполнения операции');
        setOutput(result.output || '');
        logger.error('deploy', new Error(`Ошибка деплоя ${action}`), { error: result.message, output: result.output });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      logger.error('deploy', new Error(`Ошибка деплоя ${action}`), { error: errorMessage });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Управление деплоем на Timeweb</CardTitle>
          <CardDescription>
            Запуск деплоя фронтенда и настройка nginx на сервере Timeweb
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              onClick={() => handleDeploy('frontend')}
              disabled={loading !== null}
              className="w-full"
              variant="default"
            >
              {loading === 'frontend' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Деплой...
                </>
              ) : (
                <>
                  <Rocket className="mr-2 h-4 w-4" />
                  Деплой фронтенда
                </>
              )}
            </Button>

            <Button
              onClick={() => handleDeploy('nginx')}
              disabled={loading !== null}
              className="w-full"
              variant="outline"
            >
              {loading === 'nginx' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Настройка...
                </>
              ) : (
                <>
                  <Settings className="mr-2 h-4 w-4" />
                  Настроить nginx
                </>
              )}
            </Button>

            <Button
              onClick={() => handleDeploy('diagnose')}
              disabled={loading !== null}
              className="w-full"
              variant="outline"
            >
              {loading === 'diagnose' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Диагностика...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Диагностика
                </>
              )}
            </Button>
          </div>

          {error && (
            <Card className="border-red-500 bg-red-50 dark:bg-red-950">
              <CardHeader>
                <CardTitle className="text-red-700 dark:text-red-400">Ошибка</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-sm text-red-600 dark:text-red-300 whitespace-pre-wrap break-words">
                  {error}
                </pre>
              </CardContent>
            </Card>
          )}

          {output && (
            <Card>
              <CardHeader>
                <CardTitle>Вывод операции</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-sm whitespace-pre-wrap break-words font-mono bg-gray-50 dark:bg-gray-900 p-4 rounded overflow-auto max-h-96">
                  {output}
                </pre>
              </CardContent>
            </Card>
          )}

          <div className="text-sm text-muted-foreground space-y-2">
            <p><strong>Деплой фронтенда:</strong> Собирает и загружает фронтенд на сервер Timeweb</p>
            <p><strong>Настроить nginx:</strong> Настраивает конфигурацию nginx для отдачи статики</p>
            <p><strong>Диагностика:</strong> Проверяет состояние приложения на сервере</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
