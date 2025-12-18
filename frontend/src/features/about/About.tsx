import { Car, ExternalLink, Instagram, MapPin, MessageCircle, Phone, Send } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useCityContext } from "@/contexts";
import { BottomNavigation, Header, PageHeader } from "@shared/ui/widgets";
import { cn } from "@shared/utils";
import { safeOpenLink } from "@/lib/telegram";

interface InteractiveLinkProps {
  icon: LucideIcon;
  label: string;
  href: string;
  description?: string;
  className?: string;
}

const InteractiveLink = ({
  icon: Icon,
  label,
  href,
  description,
  className,
}: InteractiveLinkProps) => {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    safeOpenLink(href, { try_instant_view: false });
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group flex w-full items-center gap-3 rounded-[16px] bg-white/10 px-4 py-3 text-left text-white transition-transform duration-200 hover:bg-white/20 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80",
        className,
      )}
    >
      <Icon className="h-5 w-5 flex-shrink-0 md:h-6 md:w-6" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-el-messiri text-base md:text-lg">{label}</span>
        {description && (
          <span className="text-xs text-white/70 md:text-sm">{description}</span>
        )}
      </span>
      <ExternalLink className="ml-auto h-4 w-4 text-white/70 transition-transform duration-200 group-hover:translate-x-0.5 md:h-5 md:w-5" />
    </a>
  );
};

const About = () => {
  const navigate = useNavigate();
  const { selectedCity, selectedRestaurant } = useCityContext();
  
  /**
   * Форматирует номер телефона для отображения
   */
  function formatPhoneForDisplay(phone: string): string {
    // Если номер уже отформатирован, возвращаем как есть
    if (phone.includes('(') || phone.includes('-')) {
      return phone;
    }
    // Иначе форматируем
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('7') && cleaned.length === 11) {
      return `+7 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7, 9)}-${cleaned.slice(9)}`;
    }
    return phone;
  }
  
  /**
   * Нормализует номер телефона для tel: ссылки
   */
  function normalizePhoneForTel(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('7')) {
      return `+${cleaned}`;
    }
    if (cleaned.startsWith('8')) {
      return `+7${cleaned.slice(1)}`;
    }
    return cleaned.length > 0 ? `+7${cleaned}` : phone;
  }
  
  /**
   * Обработчик клика по номеру телефона
   */
  function handlePhoneClick(phone: string) {
    const telLink = `tel:${normalizePhoneForTel(phone)}`;
    safeOpenLink(telLink, { try_instant_view: false });
  }
  
  /**
   * Определяет иконку для социальной сети по названию
   */
  function getSocialIcon(name: string): LucideIcon {
    const nameLower = name.toLowerCase();
    if (nameLower.includes('instagram') || nameLower.includes('инстаграм')) {
      return Instagram;
    }
    if (nameLower.includes('telegram') || nameLower.includes('телеграм')) {
      return Send;
    }
    if (nameLower.includes('vk') || nameLower.includes('вконтакте') || nameLower.includes('вк')) {
      return MessageCircle;
    }
    return ExternalLink;
  }

  return (
    <div className="app-screen overflow-hidden bg-transparent">
      {/* Header */}
      <div className="bg-transparent pb-5 md:pb-6">
        <Header />
      </div>

      {/* Main Content */}
      <div
        className="app-content bg-transparent relative overflow-hidden pt-0 md:pt-2 app-bottom-space"
      >
        <div className="app-shell app-shell-wide w-full">
          {/* Page title */}
          <PageHeader title="О нас" variant="white" onBackClick={() => navigate(-1)} />

          {/* Restaurant info from database */}
          <div
            className="space-y-6"
            style={{ paddingBottom: "calc(var(--app-bottom-inset) + 48px)" }}
          >
            <div className="relative bg-mariko-secondary rounded-[16px] p-4 md:p-6 lg:p-8 text-white transition-all duration-300 hover:bg-mariko-secondary/95">
              {/* Desktop layout */}
              <div className="hidden md:block">
                <h2 className="font-el-messiri text-2xl md:text-3xl font-bold mb-4">
                  {selectedRestaurant.name} — {selectedCity.name}
                </h2>

                {/* Phone */}
                {selectedRestaurant.phoneNumber && (
                  <div className="mb-4 max-w-md">
                    <div className="flex items-center gap-3">
                      <Phone className="w-6 h-6 flex-shrink-0" />
                      <button
                        onClick={() => handlePhoneClick(selectedRestaurant.phoneNumber || '')}
                        className="font-el-messiri text-lg md:text-xl underline decoration-dotted hover:text-white/80 transition-colors cursor-pointer text-left"
                      >
                        {formatPhoneForDisplay(selectedRestaurant.phoneNumber)}
                      </button>
                    </div>
                  </div>
                )}

                {/* Socials */}
                {selectedRestaurant.socialNetworks && selectedRestaurant.socialNetworks.length > 0 && (
                  <div className="flex flex-wrap gap-3 mb-4">
                    {selectedRestaurant.socialNetworks.map((social, index) => (
                      <InteractiveLink
                        key={index}
                        icon={getSocialIcon(social.name)}
                        label={social.name}
                        href={social.url}
                        description="Перейти"
                        className="md:w-auto"
                      />
                    ))}
                  </div>
                )}

                {/* Address - Яндекс Карты */}
                {selectedRestaurant.yandexMapsUrl && (
                  <div className="mb-4 max-w-2xl">
                    <InteractiveLink
                      icon={MapPin}
                      label={selectedRestaurant.address}
                      href={selectedRestaurant.yandexMapsUrl}
                      description="Открыть на Яндекс Картах"
                    />
                  </div>
                )}

                {/* Address - 2ГИС */}
                {selectedRestaurant.twoGisUrl && (
                  <div className="mb-4 max-w-2xl">
                    <InteractiveLink
                      icon={MapPin}
                      label={selectedRestaurant.address}
                      href={selectedRestaurant.twoGisUrl}
                      description="Открыть на 2ГИС"
                    />
                  </div>
                )}
              </div>

              {/* Mobile layout - vertical stack */}
              <div className="md:hidden flex flex-col pt-4">
                <h2 className="font-el-messiri text-xl font-bold mb-4 text-center">
                  {selectedRestaurant.name} — {selectedCity.name}
                </h2>

                {/* Phone */}
                {selectedRestaurant.phoneNumber && (
                  <div className="mb-4 w-full">
                    <div className="flex items-center justify-center gap-3">
                      <Phone className="w-5 h-5 flex-shrink-0" />
                      <button
                        onClick={() => handlePhoneClick(selectedRestaurant.phoneNumber || '')}
                        className="font-el-messiri text-base underline decoration-dotted hover:text-white/80 transition-colors cursor-pointer"
                      >
                        {formatPhoneForDisplay(selectedRestaurant.phoneNumber)}
                      </button>
                    </div>
                  </div>
                )}

                {/* Socials - vertical stack */}
                {selectedRestaurant.socialNetworks && selectedRestaurant.socialNetworks.length > 0 && (
                  <div className="flex flex-col gap-3 mb-4 w-full">
                    {selectedRestaurant.socialNetworks.map((social, index) => (
                      <InteractiveLink
                        key={index}
                        icon={getSocialIcon(social.name)}
                        label={social.name}
                        href={social.url}
                        description="Перейти"
                      />
                    ))}
                  </div>
                )}

                {/* Address - Яндекс Карты */}
                {selectedRestaurant.yandexMapsUrl && (
                  <div className="mb-4 w-full">
                    <InteractiveLink
                      icon={MapPin}
                      label={selectedRestaurant.address}
                      href={selectedRestaurant.yandexMapsUrl}
                      description="Открыть на Яндекс Картах"
                    />
                  </div>
                )}

                {/* Address - 2ГИС */}
                {selectedRestaurant.twoGisUrl && (
                  <div className="mb-6 w-full">
                    <InteractiveLink
                      icon={MapPin}
                      label={selectedRestaurant.address}
                      href={selectedRestaurant.twoGisUrl}
                      description="Открыть на 2ГИС"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Navigation */}
        <BottomNavigation currentPage="about" />
      </div>
    </div>
  );
};

export default About; 
