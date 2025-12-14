import { Suspense, lazy, useEffect, useState } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { DebugGrid } from "@/components/DebugGrid";
import { AdminProvider, CartProvider, RestaurantProvider, DebugGridProvider } from "@/contexts";
import { useEnsureUserProfileSync } from "@/hooks";
import { logger } from "@/lib/logger";
import { isActive, onActivated, onDeactivated } from "@/lib/telegram";
import { Toaster as SonnerToaster } from "@shared/ui/sonner";
import { Toaster } from "@shared/ui/toaster";
import { TooltipProvider } from "@shared/ui/tooltip";
import Index from "./pages/home";

// Lazy-load heavy background to speed up first render
const RandomBackgroundPattern = lazy(() => import("@/components/RandomBackgroundPattern"));

// Lazy load pages for better code splitting
const Profile = lazy(() => import("./pages/profile"));
const EditProfile = lazy(() => import("./pages/editProfile"));

const Restaurants = lazy(() => import("./pages/restaurants"));
const Delivery = lazy(() => import("./pages/delivery"));
const Menu = lazy(() => import("./pages/menu"));
const Orders = lazy(() => import("./pages/orders"));
const OrderSuccess = lazy(() => import("./pages/orderSuccess"));
const Review = lazy(() => import("./pages/review"));
const SelectRestaurantForReview = lazy(() => import("./pages/selectRestaurantReview"));
const About = lazy(() => import("./pages/about"));
const Booking = lazy(() => import("./pages/booking"));
const WebViewPage = lazy(() => import("./pages/webview"));
const Franchise = lazy(() => import("./pages/franchise"));
const NotFound = lazy(() => import("./pages/notFound"));
const AdminPanel = lazy(() => import("./pages/admin/AdminPanel"));

// Create a query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (replaces cacheTime)
    },
  },
});

function App() {
  useEnsureUserProfileSync();
  const [showBackground, setShowBackground] = useState(false);

  useEffect(() => {
    logger.componentLifecycle('App', 'mount');
    const updateFocus = (focused: boolean) => {
      focusManager.setFocused(focused);
      logger.debug('app', `Фокус приложения: ${focused ? 'активен' : 'неактивен'}`);
    };

    updateFocus(isActive());
    const unsubscribeActivate = onActivated(() => {
      logger.debug('app', 'Приложение активировано');
      updateFocus(true);
    });
    const unsubscribeDeactivate = onDeactivated(() => {
      logger.debug('app', 'Приложение деактивировано');
      updateFocus(false);
    });

    return () => {
      logger.componentLifecycle('App', 'unmount');
      unsubscribeActivate();
      unsubscribeDeactivate();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    const show = () => {
      if (cancelled) return;
      setShowBackground(true);
    };

    if (typeof w.requestIdleCallback === "function") {
      const id = w.requestIdleCallback(show, { timeout: 1200 });
      return () => {
        cancelled = true;
        w.cancelIdleCallback?.(id);
      };
    }

    const id = window.setTimeout(show, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AdminProvider>
          <DebugGridProvider>
            <RestaurantProvider>
              <CartProvider>
                {/* Мгновенный базовый фон, чтобы избежать "белого флэша" до загрузки паттерна */}
                <div
                  aria-hidden="true"
                  className="fixed inset-0 z-[-2] bg-[#830E0E] pointer-events-none"
                />
                {showBackground && (
                  <Suspense fallback={null}>
                    <RandomBackgroundPattern />
                  </Suspense>
                )}
                <div className="relative z-[1]">
                  <HashRouter>
                    <Suspense fallback={<></>}>
                      <Routes>
                        <Route path="/" element={<Index />} />
                        <Route path="/profile" element={<Profile />} />
                        <Route path="/edit-profile" element={<EditProfile />} />

                        <Route path="/restaurants/:id" element={<Restaurants />} />
                        <Route path="/restaurants" element={<Restaurants />} />
                        <Route path="/delivery" element={<Delivery />} />
                        <Route path="/menu" element={<Menu />} />
                        <Route path="/orders" element={<Orders />} />
                        <Route path="/order-success" element={<OrderSuccess />} />
                        <Route path="/review" element={<Review />} />
                        <Route path="/select-restaurant-review" element={<SelectRestaurantForReview />} />
                        <Route path="/booking" element={<Booking />} />
                        <Route path="/franchise" element={<Franchise />} />
                        <Route path="/webview/:slug" element={<WebViewPage />} />
                        <Route path="/about" element={<About />} />
                        <Route path="/admin" element={<AdminPanel />} />
                        {/* 404 → домой, чтобы избежать белого экрана в WebView */}
                        <Route path="/404" element={<NotFound />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </Suspense>
                  </HashRouter>
                </div>
                <DebugGrid />
                <Toaster />
                <SonnerToaster />
              </CartProvider>
            </RestaurantProvider>
          </DebugGridProvider>
        </AdminProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
