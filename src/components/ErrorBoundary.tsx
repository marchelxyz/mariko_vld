import React, { Component, ErrorInfo, ReactNode } from "react";
import { telegramWebApp } from "@/services/botApi";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    
    // Отправляем информацию об ошибке в Telegram
    if (telegramWebApp.isInTelegram()) {
      telegramWebApp.sendData({
        action: "error_report",
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      });
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-mariko-primary flex items-center justify-center px-4">
          <div className="bg-mariko-secondary rounded-[90px] p-8 text-center max-w-md">
            <h2 className="text-white font-el-messiri text-2xl font-bold mb-4">
              Упс! Что-то пошло не так
            </h2>
            <p className="text-white font-el-messiri text-lg mb-6">
              Произошла ошибка в приложении. Мы уже работаем над её исправлением.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-mariko-primary border-2 border-white rounded-[90px] px-6 py-3 text-white font-el-messiri text-xl font-bold hover:bg-white hover:text-mariko-primary transition-colors"
            >
              Перезагрузить
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;