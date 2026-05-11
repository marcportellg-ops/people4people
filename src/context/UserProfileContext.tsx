import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { getDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { getUserAlias, setUserAlias as dbSetAlias, getUserLevel, getUserTrophies, getHelperConversations, type UserDoc } from "@/lib/db";
import { type Level, calculateLevel, LEVEL_META } from "@/lib/levels";
import { type Trophy, IMPACT_TROPHY_IDS } from "@/lib/trophies";

type UserProfileContextType = {
  alias: string | null;
  level: Level;
  levelEmoji: string;
  isStar: boolean;
  trophies: Trophy[]
  streak: number;
  avgScore: number;
  qualitySessions: number;
  onboarded: boolean;
  loading: boolean;
  aliasLoaded: boolean;
  preferredLang: string | null;
  refetch: () => void;
  setAlias: (alias: string) => Promise<void>;
  setOnboardedTrue: () => void;
};

const UserProfileContext = createContext<UserProfileContextType>({
  alias: null, level: "Semilla", levelEmoji: "🌱", isStar: false,
  trophies: [], streak: 0, avgScore: 0, qualitySessions: 0,
  onboarded: false, loading: true, aliasLoaded: false, preferredLang: null,
  refetch: () => {}, setAlias: async () => {}, setOnboardedTrue: () => {},
});

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [alias, setAliasState] = useState<string | null>(null);
  const [level, setLevel] = useState<Level>("Semilla");
  const [isStar, setIsStar] = useState(false);
  const [trophies, setTrophies] = useState<Trophy[]>([]);
  const [streak, setStreak] = useState(0);
  const [avgScore, setAvgScore] = useState(0);
  const [qualitySessions, setQualitySessions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [aliasLoaded, setAliasLoaded] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [preferredLang, setPreferredLang] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); setAliasLoaded(true); return; }
    setLoading(true);
    try {
      const [a, levelData, trophyList, convs, userSnap] = await Promise.all([
        getUserAlias(user.uid),
        getUserLevel(user.uid),
        getUserTrophies(user.uid),
        getHelperConversations(user.uid),
        getDoc(doc(db, "users", user.uid)),
      ]);

      setAliasState(a);
      setAliasLoaded(true);
      setIsStar(levelData.isStar);
      setTrophies(trophyList);

      const userDoc = userSnap.exists() ? (userSnap.data() as UserDoc) : {};
      setStreak(userDoc.currentStreak ?? 0);
      setOnboarded((userDoc.onboardingCompleted === true) || (userDoc.onboarded === true));
      setPreferredLang(userDoc.language ?? null);

      const scored = convs.filter((c) => c.moderation?.score != null);
      const avg = scored.length ? scored.reduce((s, c) => s + c.moderation!.score, 0) / scored.length : 0;
      const quality = convs.filter((c) => (c.moderation?.score ?? 0) >= 7).length;
      setAvgScore(avg);
      setQualitySessions(quality);

      const hasImpact = trophyList.some((t) => IMPACT_TROPHY_IDS.includes(t.id));
      setLevel(calculateLevel(quality, hasImpact, levelData.isStar));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const setAlias = async (a: string) => {
    if (!user) return;
    await dbSetAlias(user.uid, a);
    setAliasState(a);
  };

  return (
    <UserProfileContext.Provider value={{
      alias, level, levelEmoji: LEVEL_META[level].emoji, isStar,
      trophies, streak, avgScore, qualitySessions,
      onboarded, loading, aliasLoaded, preferredLang, refetch: load, setAlias,
      setOnboardedTrue: () => setOnboarded(true),
    }}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  return useContext(UserProfileContext);
}
