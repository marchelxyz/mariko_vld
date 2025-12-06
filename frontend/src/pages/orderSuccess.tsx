import { CreditCard, ListChecks } from "lucide-react";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { BottomNavigation } from "@widgets/bottomNavigation";
import { Header } from "@widgets/header";
import { PageHeader } from "@widgets/pageHeader";
import { createYookassaPayment, fetchPaymentStatus } from "@/shared/api/payments";
import { safeOpenLink } from "@/lib/telegram";

type LocationState = {
  orderId?: string;
  restaurantId?: string | null;
  message?: string | null;
};

const FINAL_PAYMENT_STATUSES = new Set(["paid", "succeeded", "failed", "cancelled", "canceled"]);

const mapStatusToLabel = (status?: string | null) => {
  const normalized = (status || "").toLowerCase();
  if (normalized === "paid" || normalized === "succeeded") return "Оплачен";
  return "Не оплачен";
};

const mapStatusToClass = (status?: string | null) => {
  const normalized = (status || "").toLowerCase();
  if (normalized === "paid" || normalized === "succeeded") return "bg-emerald-100 text-emerald-800";
  return "bg-red-100 text-red-800";
};

const OrderSuccessPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const state = (location.state as LocationState) || {};
  const orderId = useMemo(
    () => state.orderId || searchParams.get("orderId") || "",
    [state.orderId, searchParams],
  );
  const restaurantId = state.restaurantId ?? null;
  const message = state.message ?? null;

  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [isPaymentStarting, setIsPaymentStarting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      navigate("/", { replace: true });
    }
  }, [orderId, navigate]);

  const startPayment = useCallback(async () => {
    if (!orderId || !restaurantId) {
      setPaymentError("Не хватает данных заказа для оплаты");
      return;
    }
    if (isPaymentStarting) return;
    setPaymentError(null);
    setIsPaymentStarting(true);
    try {
      const result = await createYookassaPayment({
        orderId,
        restaurantId,
      });
      if (!result?.success) {
        setPaymentError(result?.message ?? "Не удалось создать оплату");
        return;
      }
      setPaymentId(result.paymentId ?? result.providerPaymentId ?? null);
      setPaymentStatus(result.status ?? "pending");
      if (result.confirmationUrl) {
        const opened = safeOpenLink(result.confirmationUrl, { try_instant_view: false });
        if (!opened) {
          setPaymentError("Не удалось открыть ссылку на оплату, попробуйте вручную");
        }
      } else {
        setPaymentError("Ссылка на оплату не получена");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Не удалось создать оплату";
      setPaymentError(message);
    } finally {
      setIsPaymentStarting(false);
    }
  }, [isPaymentStarting, orderId, restaurantId]);

  useEffect(() => {
    if (!paymentId) return;
    if (paymentStatus && FINAL_PAYMENT_STATUSES.has(paymentStatus.toLowerCase())) {
      return;
    }
    const interval = window.setInterval(() => {
      fetchPaymentStatus(paymentId)
        .then((res) => {
          if (res?.success && res.payment) {
            setPaymentStatus(res.payment.status ?? null);
            setPaymentId(res.payment.id ?? paymentId);
          }
        })
        .catch(() => {});
    }, 5000);
    return () => window.clearInterval(interval);
  }, [paymentId, paymentStatus]);

  const statusLabel = mapStatusToLabel(paymentStatus);
  const statusClass = mapStatusToClass(paymentStatus);
  const isPaid = (paymentStatus || "").toLowerCase() === "paid" || (paymentStatus || "").toLowerCase() === "succeeded";

  return (
    <div className="min-h-screen bg-transparent flex flex-col">
      <div className="bg-transparent pb-4">
        <Header />
      </div>
      <div className="flex-1">
        <PageHeader
          title="Заказ оформлен"
          subtitle="Здесь можете оплатить или перейти в историю заказов"
          variant="white"
          onBackClick={() => navigate("/menu")}
        />

        <div className="px-4 md:px-6 max-w-3xl mx-auto w-full pb-32">
          <div className="bg-white rounded-3xl shadow-[0_15px_50px_rgba(0,0,0,0.06)] p-6 space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-mariko-dark/70">Заказ № {orderId}</p>
              {message && <p className="text-sm text-mariko-dark/80">{message}</p>}
              <div className="inline-flex items-center gap-2 text-sm">
                <span className="text-mariko-dark/70">Статус оплаты:</span>
                <span className={`px-3 py-1 rounded-full font-semibold text-xs ${statusClass}`}>
                  {statusLabel}
                </span>
              </div>
              {paymentError && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
                  {paymentError}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              {!isPaid && (
                <button
                  type="button"
                  className="w-full rounded-full bg-mariko-primary text-white py-3 font-el-messiri text-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                  disabled={isPaymentStarting || !orderId || !restaurantId}
                  onClick={startPayment}
                >
                  <CreditCard className="w-5 h-5" />
                  Оплатить
                </button>
              )}
              {isPaid && (
                <button
                  type="button"
                  className="w-full rounded-full border border-mariko-field text-mariko-primary py-3 font-semibold bg-white hover:bg-mariko-field/30 transition-colors flex items-center justify-center gap-2"
                  onClick={() => navigate("/orders")}
                >
                  <ListChecks className="w-5 h-5" />
                  Мои заказы
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-50">
        <BottomNavigation currentPage="profile" />
      </div>
    </div>
  );
};

export default OrderSuccessPage;
