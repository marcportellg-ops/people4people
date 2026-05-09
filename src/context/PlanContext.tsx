import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { getUserPlan, getConversationCountByHelper, getMyCharacters } from "@/lib/db";
import { type Plan, canStartConversation, canCreateCharacter } from "@/lib/plans";

type PlanContextType = {
  plan: Plan;
  conversationCount: number;
  characterCount: number;
  canConverse: boolean;
  canCreate: boolean;
  loading: boolean;
  refetch: () => void;
};

const PlanContext = createContext<PlanContextType>({
  plan: "free",
  conversationCount: 0,
  characterCount: 0,
  canConverse: true,
  canCreate: true,
  loading: true,
  refetch: () => {},
});

export function PlanProvider({ children }: { children: ReactNode }) {
  const { user, isModerator } = useAuth();
  const [plan, setPlan] = useState<Plan>("free");
  const [conversationCount, setConversationCount] = useState(0);
  const [characterCount, setCharacterCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    if (isModerator) { setLoading(false); return; }
    setLoading(true);
    const [p, cc, chars] = await Promise.all([
      getUserPlan(user.uid),
      getConversationCountByHelper(user.uid),
      getMyCharacters(user.uid),
    ]);
    setPlan(p);
    setConversationCount(cc);
    setCharacterCount(chars.length);
    setLoading(false);
  }, [user, isModerator]);

  useEffect(() => { load(); }, [load]);

  return (
    <PlanContext.Provider value={{
      plan: isModerator ? "creator" : plan,
      conversationCount,
      characterCount,
      canConverse: isModerator || canStartConversation(plan, conversationCount),
      canCreate: isModerator || canCreateCharacter(plan, characterCount),
      loading,
      refetch: load,
    }}>
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  return useContext(PlanContext);
}
