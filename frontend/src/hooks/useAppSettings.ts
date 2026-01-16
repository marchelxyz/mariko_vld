import { useQuery } from "@tanstack/react-query";
import { DEFAULT_APP_SETTINGS, settingsApi, type AppSettings } from "@shared/api/settings";

type UseAppSettingsResult = {
  settings: AppSettings;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
};

export const useAppSettings = (): UseAppSettingsResult => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["app-settings"],
    queryFn: () => settingsApi.getAppSettings(),
  });

  return {
    settings: data ?? DEFAULT_APP_SETTINGS,
    isLoading,
    error,
    refetch,
  };
};
