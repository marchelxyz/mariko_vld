import { Phone, Instagram, Send, MapPin, Car, MessageCircle, ExternalLink } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useCityContext } from "@/contexts/CityContext";
import { cn } from "@/lib/utils";
import { BottomNavigation } from "@widgets/bottomNavigation";
import { Header } from "@widgets/header";
import { PageHeader } from "@widgets/pageHeader";
import { CONTACTS } from "@shared/data/contacts";
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
  const { selectedCity } = useCityContext();
  const filteredContacts = CONTACTS.filter((c) => c.city === selectedCity.name);

  return (
    <div className="min-h-screen overflow-hidden flex flex-col bg-transparent">
      {/* Header */}
      <div className="bg-transparent pb-6 md:pb-8">
        <Header />
      </div>

      {/* Main Content */}
      <div
        className="flex-1 bg-transparent relative overflow-hidden pt-0 md:pt-2"
      >
        <div className="px-4 md:px-6 max-w-6xl mx-auto w-full">
          {/* Page title */}
          <PageHeader title="О нас" variant="white" onBackClick={() => navigate(-1)} />

          {/* Contacts list (filtered by selected city) */}
          <div className="space-y-6 pb-[10rem] md:pb-[12rem]">
            {filteredContacts.map((contact) => (
              <div
                key={contact.id}
                className="relative bg-mariko-secondary rounded-[16px] p-4 md:p-6 lg:p-8 text-white transition-all duration-300 hover:bg-mariko-secondary/95"
              >
                {/* Desktop layout - image on the right */}
                <div className="hidden md:block">
                  <h2 className="font-el-messiri text-2xl md:text-3xl font-bold mb-4">
                    {contact.restaurantName} — {contact.city}
                  </h2>

                  {/* Phone */}
                  {contact.phone && (
                    <div className="mb-4 max-w-md">
                      <div className="flex items-center gap-3">
                        <Phone className="w-6 h-6 flex-shrink-0" />
                        <span className="font-el-messiri text-lg md:text-xl underline decoration-dotted">
                          {contact.phone}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Socials */}
                  <div className="flex flex-wrap gap-3 mb-4">
                    {contact.instagramUrl && (
                      <InteractiveLink
                        icon={Instagram}
                        label="Instagram"
                        href={contact.instagramUrl as string}
                        description="Перейти в профиль"
                        className="md:w-auto"
                      />
                    )}
                    {contact.telegramUrl && (
                      <InteractiveLink
                        icon={Send}
                        label="Telegram"
                        href={contact.telegramUrl as string}
                        description="Перейти в Telegram-канал"
                        className="md:w-auto"
                      />
                    )}
                    {contact.vkUrl && (
                      <InteractiveLink
                        icon={MessageCircle}
                        label="VK"
                        href={contact.vkUrl as string}
                        description="Перейти в сообщество"
                        className="md:w-auto"
                      />
                    )}
                  </div>

                  {/* Address */}
                  {contact.addressUrl && (
                    <div className="mb-4 max-w-2xl">
                      <InteractiveLink
                        icon={MapPin}
                        label={contact.addressLabel ?? contact.restaurantName}
                        href={contact.addressUrl as string}
                        description="Открыть на карте"
                      />
                    </div>
                  )}

                  {/* Parking */}
                  {contact.parkingUrl && (
                    <div className="max-w-2xl">
                      <InteractiveLink
                        icon={Car}
                        label={contact.parkingLabel ?? "Парковка"}
                        href={contact.parkingUrl as string}
                        description="Посмотреть парковку"
                      />
                    </div>
                  )}


                </div>

                {/* Mobile layout - vertical stack */}
                <div className="md:hidden flex flex-col pt-4">
                  <h2 className="font-el-messiri text-xl font-bold mb-4 text-center">
                    {contact.restaurantName} — {contact.city}
                  </h2>

                  {/* Phone */}
                  {contact.phone && (
                    <div className="mb-4 w-full">
                      <div className="flex items-center justify-center gap-3">
                        <Phone className="w-5 h-5 flex-shrink-0" />
                        <span className="font-el-messiri text-base underline decoration-dotted">
                          {contact.phone}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Socials - vertical stack */}
                  <div className="flex flex-col gap-3 mb-4 w-full">
                    {contact.telegramUrl && (
                      <InteractiveLink
                        icon={Send}
                        label="Telegram"
                        href={contact.telegramUrl as string}
                        description="Написать в Telegram"
                      />
                    )}
                    {contact.vkUrl && (
                      <InteractiveLink
                        icon={MessageCircle}
                        label="VK"
                        href={contact.vkUrl as string}
                        description="Перейти в сообщество"
                      />
                    )}
                    {contact.instagramUrl && (
                      <InteractiveLink
                        icon={Instagram}
                        label="Instagram"
                        href={contact.instagramUrl as string}
                        description="Перейти в профиль"
                      />
                    )}
                  </div>

                  {/* Address */}
                  {contact.addressUrl && (
                    <div className="mb-4 w-full">
                      <InteractiveLink
                        icon={MapPin}
                        label={contact.addressLabel ?? contact.restaurantName}
                        href={contact.addressUrl as string}
                        description="Открыть на карте"
                      />
                    </div>
                  )}

                  {/* Parking */}
                  {contact.parkingUrl && (
                    <div className="mb-6 w-full">
                      <InteractiveLink
                        icon={Car}
                        label={contact.parkingLabel ?? "Парковка"}
                        href={contact.parkingUrl as string}
                        description="Посмотреть парковку"
                      />
                    </div>
                  )}


                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Navigation */}
        <div className="absolute bottom-0 left-0 right-0 z-50">
          <BottomNavigation currentPage="about" />
        </div>
      </div>
    </div>
  );
};

export default About; 
