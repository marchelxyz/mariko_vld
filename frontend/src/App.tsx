import { Suspense, lazy, useEffect } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import RandomBackgroundPattern from "@/components/RandomBackgroundPattern";
import { DebugGrid } from "@/components/DebugGrid";
import { AdminProvider, CartProvider, RestaurantProvider, DebugGridProvider, OnboardingProvider } from "@/contexts";
import { useEnsureUserProfileSync } from "@/hooks";
import { useProfile } from "@/entities/user";
import { useProfile } from "@/entities/user";
import { logger } from "@/lib/logger";
import { isActive, onActivated, onDeactivated, requestFullscreenMode } from "@/lib/platform";
import { Toaster as SonnerToaster } from "@shared/ui/sonner";
import { Toaster } from "@shared/ui/toaster";
import { TooltipProvider } from "@shared/ui/tooltip";
import Index from "./pages/home";

// Keep the home page in the main chunk; lazy-load the rest for better code splitting
const Profile = lazy(() => import("./pages/profile"));
const EditProfile = lazy(() => import("./pages/editProfile"));
const Settings = lazy(() => import("./pages/settings"));

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
const BlockedPage = lazy(() => import("./pages/blocked"));
const BlockedPage = lazy(() => import("./pages/blocked"));

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

function AppContent() {
  useEnsureUserProfileSync();
  const { profile, isInitialized } = useProfile();

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
      // Автоматически переходим в полноэкранный режим при активации
      requestFullscreenMode();
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

  if (isInitialized && profile.isBanned) {
    return (
      <Suspense
        fallback={
          <div className="flex min-h-[60vh] items-center justify-center text-white/70">
            Загрузка…
          </div>
        }
      >
        <BlockedPage />
      </Suspense>
    );
  }

  return (
    <>
      <AdminProvider>
        <DebugGridProvider>
          <RestaurantProvider>
            <CartProvider>
              <RandomBackgroundPattern />
              <div className="relative z-[1]">
                {isInitialized && profile.isBanned ? (
                  <Suspense
                    fallback={
                      <div className="flex min-h-[60vh] items-center justify-center text-white/70">
                        Загрузка…
                      </div>
                    }
                  >
                    <BlockedPage />
                  </Suspense>
                ) : (
                  <HashRouter>
                    <Suspense
                      fallback={
                        <div className="flex min-h-[60vh] items-center justify-center text-white/70">
                          Загрузка…
                        </div>
                      }
                    >
                      <Routes>
                        <Route path="/" element={<Index />} />
                        <Route path="/profile" element={<Profile />} />
                        <Route path="/edit-profile" element={<EditProfile />} />
                        <Route path="/settings" element={<Settings />} />

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
                )}
              </div>
              <DebugGrid />
              <Toaster />
              <SonnerToaster />
            </CartProvider>
          </RestaurantProvider>
        </DebugGridProvider>
      </AdminProvider>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <OnboardingProvider>
          <AppContent />
        </OnboardingProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
