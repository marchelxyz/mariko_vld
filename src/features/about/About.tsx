import { Header } from "@widgets/header";
import { PageHeader } from "@widgets/pageHeader";
import { BottomNavigation } from "@widgets/bottomNavigation";
import { CONTACTS } from "@shared/data/contacts";
import { Phone, Instagram, Send, MapPin, Car, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const About = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen overflow-hidden flex flex-col bg-mariko-primary">
      {/* Header */}
      <div className="bg-mariko-primary pb-6 md:pb-8">
        <Header />
      </div>

      {/* Main Content */}
      <div
        className="flex-1 bg-[#FFFBF0] relative overflow-hidden rounded-t-[24px] md:rounded-t-[32px] pt-0 md:pt-2
        before:content-[''] before:absolute before:top-0 before:left-0 before:right-0
        before:h-[20px] md:before:h-[24px]
        before:bg-gradient-to-b before:from-black/30 before:to-transparent
        before:rounded-t-[24px] md:before:rounded-t-[32px]"
      >
        <div className="px-4 md:px-6 max-w-6xl mx-auto w-full">
          {/* Page title */}
          <PageHeader title="О нас" onBackClick={() => navigate(-1)} />

          {/* Contacts list */}
          <div className="space-y-6 pb-[10rem] md:pb-[12rem]">
            {CONTACTS.map((contact) => (
              <div
                key={contact.id}
                className="relative bg-mariko-secondary rounded-[90px] p-6 md:p-8 text-white"
              >
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
                      <span className="hidden md:inline">Instagram</span>
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
                      <span className="hidden md:inline">Telegram</span>
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
                      <span className="hidden md:inline">VK</span>
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

                {/* Decorative Image */}
                <img
                  src="/images/characters/Hachapuri.png"
                  alt="Хачапури Марико"
                  className="absolute top-11 right-14 w-32 h-32 sm:w-36 sm:h-36 md:w-44 md:h-44 lg:w-52 lg:h-52 object-contain rounded-[50px]"
                />
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