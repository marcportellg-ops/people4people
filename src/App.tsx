import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { ProtectedRoute, ModeratorRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index.tsx";
import Login from "./pages/Login.tsx";
import NotFound from "./pages/NotFound.tsx";
import Gallery from "./pages/Gallery.tsx";
import Conversation from "./pages/Conversation.tsx";
import Create from "./pages/Create.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Subscribe from "./pages/Subscribe.tsx";
import Profile from "./pages/Profile.tsx";
import EditCharacter from "./pages/EditCharacter.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <LanguageProvider>
          <Routes>
            {/* Public — only the login page */}
            <Route path="/login" element={<Login />} />

            {/* Requires sign-in */}
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />

            {/* Requires sign-in */}
            <Route path="/gallery" element={<ProtectedRoute><Gallery /></ProtectedRoute>} />
            <Route path="/talk/:id" element={<ProtectedRoute><Conversation /></ProtectedRoute>} />
            <Route path="/create" element={<ProtectedRoute><Create /></ProtectedRoute>} />
            <Route path="/subscribe" element={<ProtectedRoute><Subscribe /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/edit/:id" element={<ProtectedRoute><EditCharacter /></ProtectedRoute>} />

            {/* Requires supermoderator account */}
            <Route path="/dashboard" element={<ModeratorRoute><Dashboard /></ModeratorRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
          </LanguageProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
