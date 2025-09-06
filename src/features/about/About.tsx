import { Header } from "@widgets/header";
import { PageHeader } from "@widgets/pageHeader";
import { BottomNavigation } from "@widgets/bottomNavigation";
import { CONTACTS } from "@shared/data/contacts";
import { Phone, Instagram, Send, MapPin, Car, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const About = () => {
  const navigate = useNavigate();

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

          {/* Contacts list */}
          <div className="space-y-6 pb-[10rem] md:pb-[12rem]">
            {CONTACTS.map((contact) => (
              <div
                key={contact.id}
                className="relative bg-mariko-secondary rounded-[90px] p-4 md:p-6 lg:p-8 text-white transition-all duration-300 hover:bg-mariko-secondary/95"
              >
                {/* Desktop layout - image on the right */}
                <div className="hidden md:block">
                  <h2 className="font-el-messiri text-2xl md:text-3xl font-bold mb-4">
                    {contact.restaurantName} — {contact.city}
                  </h2>

                  {/* Phone */}
                  {contact.phone && (
                    <div className="flex items-center gap-3 mb-3">
                      <Phone className="w-6 h-6 flex-shrink-0" />
                      <a
                        href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`}
                        className="font-el-messiri text-lg md:text-xl hover:underline"
                      >
                        {contact.phone}
                      </a>
                    </div>
                  )}

                  {/* Socials */}
                  <div className="flex items-center gap-4 mb-4 flex-wrap">
                    {contact.instagramUrl && (
                      <a
                        href={contact.instagramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 hover:underline"
                      >
                        <Instagram className="w-6 h-6" />
                        <span>Instagram</span>
                      </a>
                    )}
                    {contact.telegramUrl && (
                      <a
                        href={contact.telegramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 hover:underline"
                      >
                        <Send className="w-6 h-6" />
                        <span>Telegram</span>
                      </a>
                    )}
                    {contact.vkUrl && (
                      <a
                        href={contact.vkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 hover:underline"
                      >
                        <MessageCircle className="w-6 h-6" />
                        <span>VK</span>
                      </a>
                    )}
                  </div>

                  {/* Address */}
                  {contact.addressUrl && (
                    <div className="flex items-center gap-3 mb-3">
                      <MapPin className="w-6 h-6 flex-shrink-0" />
                      <a
                        href={contact.addressUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-el-messiri text-lg md:text-xl hover:underline"
                      >
                        {contact.addressLabel}
                      </a>
                    </div>
                  )}

                  {/* Parking */}
                  {contact.parkingUrl && (
                    <div className="flex items-center gap-3">
                      <Car className="w-6 h-6 flex-shrink-0" />
                      <a
                        href={contact.parkingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-el-messiri text-lg md:text-xl hover:underline"
                      >
                        {contact.parkingLabel}
                      </a>
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
                    <div className="flex flex-col items-center gap-2 mb-4">
                      <div className="flex items-center gap-3">
                        <Phone className="w-5 h-5 flex-shrink-0" />
                        <a
                          href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`}
                          className="font-el-messiri text-base hover:underline"
                        >
                          {contact.phone}
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Socials - vertical stack */}
                  <div className="flex flex-col items-center gap-3 mb-4">
                    {contact.telegramUrl && (
                      <a
                        href={contact.telegramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 hover:underline"
                      >
                        <Send className="w-5 h-5" />
                        <span className="font-el-messiri text-base">Telegram</span>
                      </a>
                    )}
                    {contact.vkUrl && (
                      <a
                        href={contact.vkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 hover:underline"
                      >
                        <MessageCircle className="w-5 h-5" />
                        <span className="font-el-messiri text-base">VK</span>
                      </a>
                    )}
                    {contact.instagramUrl && (
                      <a
                        href={contact.instagramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 hover:underline"
                      >
                        <Instagram className="w-5 h-5" />
                        <span className="font-el-messiri text-base">Instagram</span>
                      </a>
                    )}
                  </div>

                  {/* Address */}
                  {contact.addressUrl && (
                    <div className="flex flex-col items-center gap-2 mb-4">
                      <div className="flex items-center gap-3">
                        <MapPin className="w-5 h-5 flex-shrink-0" />
                        <a
                          href={contact.addressUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-el-messiri text-base hover:underline text-center"
                        >
                          {contact.addressLabel}
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Parking */}
                  {contact.parkingUrl && (
                    <div className="flex flex-col items-center gap-2 mb-6">
                      <div className="flex items-center gap-3">
                        <Car className="w-5 h-5 flex-shrink-0" />
                        <a
                          href={contact.parkingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-el-messiri text-base hover:underline text-center"
                        >
                          {contact.parkingLabel}
                        </a>
                      </div>
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