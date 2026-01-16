import { Mail, ShieldAlert } from "lucide-react";
import { Button } from "@shared/ui/button";
import { Header } from "@shared/ui/widgets";
import { useAppSettings } from "@/hooks";

const BlockedPage = () => {
  const { settings } = useAppSettings();
  const supportEmail = settings.supportEmail?.trim();
  const supportLink = supportEmail ? `mailto:${supportEmail}` : undefined;

  return (
    <div className="app-screen min-h-screen bg-transparent overflow-hidden flex flex-col">
      <Header />
      <div className="flex-1 px-4 md:px-6 max-w-3xl mx-auto w-full flex items-center justify-center">
        <div className="bg-mariko-secondary rounded-[24px] p-10 text-center">
          <ShieldAlert className="w-14 h-14 text-white/30 mx-auto mb-4" />
          <h2 className="text-white font-el-messiri text-2xl font-bold mb-3">
            Доступ ограничен
          </h2>
          <p className="text-white/70 mb-6">
            Вас заблокировала администрация приложения. Свяжитесь с поддержкой, чтобы узнать подробнее.
          </p>
          <Button
            asChild
            variant="default"
            className="inline-flex items-center gap-2"
            disabled={!supportLink}
          >
            {supportLink ? (
              <a href={supportLink}>
                <Mail className="w-4 h-4" />
                Написать в поддержку
              </a>
            ) : (
              <span className="inline-flex items-center gap-2 opacity-70">
                <Mail className="w-4 h-4" />
                Почта поддержки не указана
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BlockedPage;
