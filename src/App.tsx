import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CityProvider } from "@/contexts/CityContext";
import Index from "./pages/Index";
import Profile from "./pages/Profile";
import EditProfile from "./pages/EditProfile";
import Franchise from "./pages/Franchise";
import Delivery from "./pages/Delivery";
import Promotions from "./pages/Promotions";
import Booking from "./pages/Booking";
import Review from "./pages/Review";
import Restaurants from "./pages/Restaurants";
import AdminPanel from "./pages/AdminPanel";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <CityProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/edit-profile" element={<EditProfile />} />
            <Route path="/franchise" element={<Franchise />} />
            <Route path="/delivery" element={<Delivery />} />
            <Route path="/promotions" element={<Promotions />} />
            <Route path="/booking" element={<Booking />} />
            <Route path="/review" element={<Review />} />
            <Route path="/restaurants" element={<Restaurants />} />
            <Route
              path="/restaurants/:restaurantId"
              element={<Restaurants />}
            />
            <Route path="/admin" element={<AdminPanel />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </CityProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
