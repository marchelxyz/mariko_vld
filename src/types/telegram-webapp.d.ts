// Глобальные типы для Telegram WebApp API

export {};

declare global {
  interface Window {
    Telegram: {
      WebApp: {
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code: string;
          };
        };
        ready: () => void;
        close: () => void;
        sendData: (data: string) => void;
        openLink: (
          url: string,
          options?: {
            try_instant_view?: boolean;
          }
        ) => void;
        MainButton: {
          text: string;
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
        };
      };
    };
  }
}


