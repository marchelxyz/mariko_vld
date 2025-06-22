import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CityProvider } from "@/contexts/CityContext";

// Lazy load pages for better code splitting
const Index = lazy(() => import("./pages/Index"));
const Profile = lazy(() => import("./pages/Profile"));
const EditProfile = lazy(() => import("./pages/EditProfile"));

const Restaurants = lazy(() => import("./pages/Restaurants"));
const Booking = lazy(() => import("./pages/Booking"));
const Delivery = lazy(() => import("./pages/Delivery"));
const Promotions = lazy(() => import("./pages/Promotions"));
const Review = lazy(() => import("./pages/Review"));
const SelectRestaurantForReview = lazy(() => import("./pages/SelectRestaurantForReview"));
const MenuSelection = lazy(() => import("./pages/MenuSelection"));
const NotFound = lazy(() => import("./pages/NotFound"));

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

// Loading component for suspense
const PageLoader = () => (
  <div className="min-h-screen bg-mariko-primary flex items-center justify-center">
    <div className="w-12 h-12 border-4 border-mariko-secondary border-t-transparent rounded-full animate-spin"></div>
  </div>
);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CityProvider>
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/edit-profile" element={<EditProfile />} />

                <Route path="/restaurants/:id" element={<Restaurants />} />
                <Route path="/restaurants" element={<Restaurants />} />
                <Route path="/booking" element={<Booking />} />
                <Route path="/delivery" element={<Delivery />} />
                <Route path="/promotions" element={<Promotions />} />
                <Route path="/review" element={<Review />} />
                <Route path="/select-restaurant-review" element={<SelectRestaurantForReview />} />
                <Route path="/menu" element={<MenuSelection />} />
                {/* Catch-all route for 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
          <Toaster />
        </CityProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
