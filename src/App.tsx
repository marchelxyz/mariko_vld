import { Suspense, lazy } from "react";
import { TooltipProvider } from "@shared/ui/tooltip";
import { Toaster } from "@shared/ui/toaster";
import { Toaster as SonnerToaster } from "@shared/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { RestaurantProvider } from "@/contexts/CityContext";

// Lazy load pages for better code splitting
const Index = lazy(() => import("./pages/home"));
const Profile = lazy(() => import("./pages/profile"));
const EditProfile = lazy(() => import("./pages/editProfile"));

const Restaurants = lazy(() => import("./pages/restaurants"));
const Booking = lazy(() => import("./pages/booking"));
const Delivery = lazy(() => import("./pages/delivery"));
const Promotions = lazy(() => import("./pages/promotions"));
const Review = lazy(() => import("./pages/review"));
const SelectRestaurantForReview = lazy(() => import("./pages/selectRestaurantReview"));
const MenuSelection = lazy(() => import("./pages/menu"));
const JobApplication = lazy(() => import("./pages/jobApplication"));
const NotFound = lazy(() => import("./pages/notFound"));

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
        <RestaurantProvider>
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
                <Route path="/job-application" element={<JobApplication />} />
                {/* Catch-all route for 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
          <Toaster />
          <SonnerToaster />
        </RestaurantProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
