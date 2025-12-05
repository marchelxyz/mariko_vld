import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { Suspense, lazy, useEffect } from "react";
import { Navigate, HashRouter, Route, Routes } from "react-router-dom";
import { CartProvider, RestaurantProvider } from "@/contexts";
import { useEnsureUserProfileSync } from "@/hooks";
import { Toaster as SonnerToaster } from "@shared/ui/sonner";
import { Toaster } from "@shared/ui/toaster";
import { TooltipProvider } from "@shared/ui/tooltip";
import { isActive, onActivated, onDeactivated } from "@/lib/telegram";

// Lazy load pages for better code splitting
const Index = lazy(() => import("./pages/home"));
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

  useEffect(() => {
    const updateFocus = (focused: boolean) => {
      focusManager.setFocused(focused);
    };

    updateFocus(isActive());
    const unsubscribeActivate = onActivated(() => updateFocus(true));
    const unsubscribeDeactivate = onDeactivated(() => updateFocus(false));

    return () => {
      unsubscribeActivate();
      unsubscribeDeactivate();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RestaurantProvider>
          <CartProvider>
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
            <Toaster />
            <SonnerToaster />
          </CartProvider>
        </RestaurantProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
