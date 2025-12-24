import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type VKUser = {
  id: number;
  first_name: string;
  last_name: string;
  photo_200?: string;
  photo_100?: string;
};

type VKContextType = {
  isVK: boolean;
  user: VKUser | null;
  initVK: () => Promise<void>;
  vkBridge: any;
};

const VKContext = createContext<VKContextType | undefined>(undefined);

export function VKProvider({ children }: { children: ReactNode }) {
  const [isVK, setIsVK] = useState(false);
  const [user, setUser] = useState<VKUser | null>(null);
  const [vkBridge, setVkBridge] = useState<any>(null);

  const initVK = async () => {
    // Проверка, что мы в ВК
    if (typeof window !== 'undefined') {
      const vk = (window as any).vk;
      
      if (vk && vk.Bridge) {
        setIsVK(true);
        setVkBridge(vk.Bridge);
        
        try {
          // Инициализация VK Bridge
          await vk.Bridge.send('VKWebAppInit');
          
          // Получение информации о пользователе
          const userInfo = await vk.Bridge.send('VKWebAppGetUserInfo');
          if (userInfo) {
            setUser({
              id: userInfo.id,
              first_name: userInfo.first_name || '',
              last_name: userInfo.last_name || '',
              photo_200: userInfo.photo_200,
              photo_100: userInfo.photo_100,
            });
          }
        } catch (error) {
          console.error('Ошибка инициализации VK:', error);
        }
      }
    }
  };

  useEffect(() => {
    // Проверяем наличие VK Bridge после загрузки страницы
    if (typeof window !== 'undefined') {
      const checkVK = () => {
        if ((window as any).vk && (window as any).vk.Bridge) {
          initVK();
        } else {
          // Повторяем проверку через небольшую задержку, если SDK еще не загружен
          setTimeout(checkVK, 100);
        }
      };
      
      checkVK();
    }
  }, []);

  return (
    <VKContext.Provider value={{ isVK, user, initVK, vkBridge }}>
      {children}
    </VKContext.Provider>
  );
}

export function useVK() {
  const context = useContext(VKContext);
  if (context === undefined) {
    throw new Error('useVK must be used within a VKProvider');
  }
  return context;
}
