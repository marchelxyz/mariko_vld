import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type VKUser = {
  id: number;
  first_name: string;
  last_name: string;
  photo_200?: string;
  photo_100?: string;
};

/**
 * Синхронизирует профиль VK пользователя с бэкендом
 */
async function syncVKProfile(user: VKUser): Promise<void> {
  try {
    const baseUrl = import.meta.env.VITE_SERVER_API_URL 
      ? import.meta.env.VITE_SERVER_API_URL.replace(/\/$/, "")
      : (import.meta.env.VITE_CART_API_URL ?? "/api/cart/submit").replace(/\/cart\/submit\/?$/, "");
    
    const endpoint = `${baseUrl}/cart/profile/sync`;
    const userId = String(user.id);
    const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || "Пользователь";
    const photo = user.photo_200 || user.photo_100 || "";

    await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-VK-Id": userId,
      },
      body: JSON.stringify({
        id: userId,
        name: displayName,
        photo,
        vkId: user.id,
      }),
    });
  } catch (error) {
    console.warn("Ошибка синхронизации VK профиля:", error);
  }
}

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
            const vkUser = {
              id: userInfo.id,
              first_name: userInfo.first_name || '',
              last_name: userInfo.last_name || '',
              photo_200: userInfo.photo_200,
              photo_100: userInfo.photo_100,
            };
            setUser(vkUser);
            
            // Сохраняем VK ID в window для использования в заголовках запросов
            if (typeof window !== 'undefined') {
              (window as any).__VK_USER_ID__ = String(vkUser.id);
              (window as any).__VK_CONTEXT__ = { user: vkUser };
            }
            
            // Синхронизируем профиль с бэкендом
            syncVKProfile(vkUser).catch((error) => {
              console.warn('Не удалось синхронизировать VK профиль:', error);
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
