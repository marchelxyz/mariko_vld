import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import { CityProvider } from "@/contexts/CityContext";

// Lazy load pages for better code splitting
const Index = lazy(() => import("./features/home"));
const Profile = lazy(() => import("./features/profile"));
const EditProfile = lazy(() => import("./features/profile/edit"));

const Restaurants = lazy(() => import("./features/restaurants"));
const Booking = lazy(() => import("./features/booking"));
const Delivery = lazy(() => import("./features/delivery"));
const Promotions = lazy(() => import("./features/promotions"));
const Review = lazy(() => import("./features/review"));
const SelectRestaurantForReview = lazy(() => import("./features/review/selectRestaurant"));
const MenuSelection = lazy(() => import("./features/menu"));
const JobApplication = lazy(() => import("./features/jobApplication"));
const NotFound = lazy(() => import("./features/notFound"));

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
          <HashRouter>
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
          </HashRouter>
          <Toaster />
          <SonnerToaster />
        </CityProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
