import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, auth, isSuperModerator, type User } from "@/lib/auth";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  isModerator: boolean;
};

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, isModerator: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isModerator: isSuperModerator(user) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
