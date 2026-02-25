import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getUserId, onActivated } from "@/lib/platform";
import {
  fetchDeliveryAccessStatus,
  type DeliveryAccessMode,
} from "@shared/api/deliveryAccess";

export function useDeliveryAccess() {
  const userId = getUserId();
  const queryKey = ["delivery-access", userId ?? "anonymous"] as const;

  const query = useQuery({
    queryKey,
    queryFn: () => fetchDeliveryAccessStatus(userId),
    staleTime: 5_000,
    retry: 1,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: "always",
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    const unsubscribe = onActivated(() => {
      void query.refetch();
    });

    return () => {
      unsubscribe();
    };
  }, [query.refetch]);

  return {
    hasAccess: query.data?.hasAccess === true,
    mode: (query.data?.mode ?? "list") as DeliveryAccessMode,
    profileId: query.data?.profileId ?? null,
    source: query.data?.source ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error ?? null,
    refetch: query.refetch,
  };
}
