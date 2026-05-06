import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}

export function ModeratorRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isModerator } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!isModerator) return <Navigate to="/gallery" replace />;

  return <>{children}</>;
}
