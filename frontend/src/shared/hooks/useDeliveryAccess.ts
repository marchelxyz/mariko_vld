import { useQuery } from "@tanstack/react-query";
import { getUserId } from "@/lib/platform";
import {
  fetchDeliveryAccessStatus,
  type DeliveryAccessMode,
} from "@shared/api/deliveryAccess";

export function useDeliveryAccess() {
  const userId = getUserId();

  const query = useQuery({
    queryKey: ["delivery-access", userId ?? "anonymous"],
    queryFn: () => fetchDeliveryAccessStatus(userId),
    staleTime: 60_000,
    retry: 1,
  });

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
