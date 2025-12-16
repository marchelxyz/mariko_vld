import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "../utils/logger.mjs";
import path from "path";
import { fileURLToPath } from "url";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Путь к корню проекта (от backend/server/services до корня)
const PROJECT_ROOT = path.resolve(__dirname, "../../../..");

/**
 * Запускает скрипт деплоя фронтенда на Timeweb
 * @returns {Promise<{success: boolean, output: string, error?: string}>}
 */
export async function deployFrontend() {
  try {
    const deployScript = path.join(PROJECT_ROOT, "scripts", "deploy-local.sh");
    const envFile = path.join(PROJECT_ROOT, ".env.deploy");

    // Проверяем наличие .env.deploy
    const fs = await import("fs/promises");
    try {
      await fs.access(envFile);
    } catch {
      return {
        success: false,
        output: "",
        error: "Файл .env.deploy не найден. Создайте его на основе примера.",
      };
    }

    // Убеждаемся, что скрипт имеет права на выполнение
    try {
      const stats = await fs.stat(deployScript);
      const mode = stats.mode;
      const isExecutable = (mode & parseInt('111', 8)) !== 0;
      if (!isExecutable) {
        await fs.chmod(deployScript, 0o755);
      }
    } catch (error) {
      logger.warn("Не удалось проверить/установить права на выполнение скрипта", { error });
    }

    // Запускаем скрипт с переменной окружения
    const { stdout, stderr } = await execAsync(
      `DEPLOY_ENV_FILE=.env.deploy bash "${deployScript}"`,
      {
        cwd: PROJECT_ROOT,
        env: { ...process.env, DEPLOY_ENV_FILE: ".env.deploy" },
        maxBuffer: 10 * 1024 * 1024, // 10MB для больших выводов
      },
    );

    const output = stdout || stderr || "";
    logger.info("Деплой фронтенда завершён", { output: output.substring(0, 500) });

    return {
      success: true,
      output: output,
    };
  } catch (error) {
    logger.error("Ошибка деплоя фронтенда", error);
    return {
      success: false,
      output: error.stdout || "",
      error: error.message || String(error),
    };
  }
}

/**
 * Настраивает nginx на Timeweb
 * @returns {Promise<{success: boolean, output: string, error?: string}>}
 */
export async function setupNginx() {
  try {
    const setupScript = path.join(PROJECT_ROOT, "scripts", "setup-timeweb-nginx.sh");
    const envFile = path.join(PROJECT_ROOT, ".env.deploy");

    // Проверяем наличие .env.deploy
    const fs = await import("fs/promises");
    try {
      await fs.access(envFile);
    } catch {
      return {
        success: false,
        output: "",
        error: "Файл .env.deploy не найден. Создайте его на основе примера.",
      };
    }

    // Убеждаемся, что скрипт имеет права на выполнение
    try {
      const stats = await fs.stat(setupScript);
      const mode = stats.mode;
      const isExecutable = (mode & parseInt('111', 8)) !== 0;
      if (!isExecutable) {
        await fs.chmod(setupScript, 0o755);
      }
    } catch (error) {
      logger.warn("Не удалось проверить/установить права на выполнение скрипта", { error });
    }

    // Запускаем скрипт с переменной окружения
    const { stdout, stderr } = await execAsync(
      `DEPLOY_ENV_FILE=.env.deploy bash "${setupScript}"`,
      {
        cwd: PROJECT_ROOT,
        env: { ...process.env, DEPLOY_ENV_FILE: ".env.deploy" },
        maxBuffer: 10 * 1024 * 1024,
      },
    );

    const output = stdout || stderr || "";
    logger.info("Настройка nginx завершена", { output: output.substring(0, 500) });

    return {
      success: true,
      output: output,
    };
  } catch (error) {
    logger.error("Ошибка настройки nginx", error);
    return {
      success: false,
      output: error.stdout || "",
      error: error.message || String(error),
    };
  }
}

/**
 * Запускает диагностику состояния приложения на Timeweb
 * @returns {Promise<{success: boolean, output: string, error?: string}>}
 */
export async function diagnoseTimeweb() {
  try {
    const diagnoseScript = path.join(PROJECT_ROOT, "scripts", "diagnose-timeweb.sh");
    const envFile = path.join(PROJECT_ROOT, ".env.deploy");

    // Проверяем наличие .env.deploy
    const fs = await import("fs/promises");
    try {
      await fs.access(envFile);
    } catch {
      return {
        success: false,
        output: "",
        error: "Файл .env.deploy не найден. Создайте его на основе примера.",
      };
    }

    // Убеждаемся, что скрипт имеет права на выполнение
    try {
      const stats = await fs.stat(diagnoseScript);
      const mode = stats.mode;
      const isExecutable = (mode & parseInt('111', 8)) !== 0;
      if (!isExecutable) {
        await fs.chmod(diagnoseScript, 0o755);
      }
    } catch (error) {
      logger.warn("Не удалось проверить/установить права на выполнение скрипта", { error });
    }

    // Запускаем скрипт с переменной окружения
    const { stdout, stderr } = await execAsync(
      `DEPLOY_ENV_FILE=.env.deploy bash "${diagnoseScript}"`,
      {
        cwd: PROJECT_ROOT,
        env: { ...process.env, DEPLOY_ENV_FILE: ".env.deploy" },
        maxBuffer: 10 * 1024 * 1024,
      },
    );

    const output = stdout || stderr || "";
    logger.info("Диагностика завершена", { output: output.substring(0, 500) });

    return {
      success: true,
      output: output,
    };
  } catch (error) {
    logger.error("Ошибка диагностики", error);
    return {
      success: false,
      output: error.stdout || "",
      error: error.message || String(error),
    };
  }
}
