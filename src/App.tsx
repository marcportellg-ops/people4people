import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { LanguageProvider, useLanguage } from "@/context/LanguageContext";
import { PlanProvider } from "@/context/PlanContext";
import { UserProfileProvider, useUserProfile } from "@/context/UserProfileContext";
import { ProtectedRoute, ModeratorRoute } from "@/components/ProtectedRoute";
import { AliasSelector } from "@/components/AliasSelector";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useRef } from "react";
import type { Language } from "@/lib/translations";
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
import Welcome from "./pages/Welcome.tsx";
import DemoConversation from "./pages/DemoConversation.tsx";

const queryClient = new QueryClient();

// Applies the Firestore-persisted language preference on first load.
// Runs once after UserProfile finishes loading — covers cross-device scenarios
// where localStorage has a stale or missing language.
function LangSync() {
  const { preferredLang, loading } = useUserProfile();
  const { setLang } = useLanguage();
  const applied = useRef(false);

  useEffect(() => {
    if (applied.current || loading || !preferredLang) return;
    applied.current = true;
    setLang(preferredLang as Language);
  }, [loading, preferredLang]);

  return null;
}

const ONBOARDING_GATE_BYPASS = ["/welcome", "/demo"]; // don't redirect away from these
const ALIAS_GATE_BYPASS = ["/demo"]; // alias not required here

// Redirects un-onboarded users to /welcome synchronously at render time
function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { user, isModerator, loading: authLoading } = useAuth();
  const { onboarded, loading: profileLoading } = useUserProfile();
  const location = useLocation();

  if (authLoading || profileLoading) return <>{children}</>;
  if (!user || isModerator) return <>{children}</>;
  if (ONBOARDING_GATE_BYPASS.includes(location.pathname)) return <>{children}</>;
  if (!onboarded) return <Navigate to="/welcome" replace />;
  return <>{children}</>;
}

// Gate: show AliasSelector for logged-in users who haven't chosen an alias yet
function AliasGate({ children }: { children: React.ReactNode }) {
  const { user, isModerator } = useAuth();
  const { alias, aliasLoaded } = useUserProfile();
  const location = useLocation();
  if (ALIAS_GATE_BYPASS.includes(location.pathname)) return <>{children}</>;
  if (user && !isModerator && aliasLoaded && alias === null) return <AliasSelector />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <LanguageProvider>
          <UserProfileProvider>
          <LangSync />
          <PlanProvider>
          <OnboardingGate>
          <AliasGate>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/gallery" element={<ProtectedRoute><Gallery /></ProtectedRoute>} />
            <Route path="/talk/:id" element={<ProtectedRoute><Conversation /></ProtectedRoute>} />
            <Route path="/create" element={<ProtectedRoute><Create /></ProtectedRoute>} />
            <Route path="/subscribe" element={<ProtectedRoute><Subscribe /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/edit/:id" element={<ProtectedRoute><EditCharacter /></ProtectedRoute>} />
            <Route path="/welcome" element={<ProtectedRoute><Welcome /></ProtectedRoute>} />
            <Route path="/demo" element={<ProtectedRoute><DemoConversation /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ModeratorRoute><Dashboard /></ModeratorRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </AliasGate>
          </OnboardingGate>
          </PlanProvider>
          </UserProfileProvider>
          </LanguageProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
