import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { getDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { getUserAlias, setUserAlias as dbSetAlias, getUserLevel, getUserTrophies, getHelperConversations, type UserDoc } from "@/lib/db";
import { type Level, calculateLevel, LEVEL_META } from "@/lib/levels";
import { type Trophy, IMPACT_TROPHY_IDS } from "@/lib/trophies";

const ONBOARDED_KEY = (uid: string) => `p4p_onboarded_${uid}`;
const NOA_KEY       = (uid: string) => `p4p_noa_${uid}`;

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
  noaCompleted: boolean;
  loading: boolean;
  aliasLoaded: boolean;
  preferredLang: string | null;
  refetch: () => void;
  setAlias: (alias: string) => Promise<void>;
  setOnboardedTrue: () => void;
  setNoaCompletedTrue: () => void;
};

const UserProfileContext = createContext<UserProfileContextType>({
  alias: null, level: "Semilla", levelEmoji: "🌱", isStar: false,
  trophies: [], streak: 0, avgScore: 0, qualitySessions: 0,
  onboarded: false, noaCompleted: false, loading: true, aliasLoaded: false, preferredLang: null,
  refetch: () => {}, setAlias: async () => {}, setOnboardedTrue: () => {}, setNoaCompletedTrue: () => {},
});

export function UserProfileProvider({ children }: { children: ReactNode }) {
  // authLoading is included so that `loading` stays true until Firebase auth
  // has settled — prevents the one-render window where profileLoading=false
  // but the user profile hasn't been fetched for the authenticated user yet.
  const { user, loading: authLoading } = useAuth();
  const [alias, setAliasState] = useState<string | null>(null);
  const [level, setLevel] = useState<Level>("Semilla");
  const [isStar, setIsStar] = useState(false);
  const [trophies, setTrophies] = useState<Trophy[]>([]);
  const [streak, setStreak] = useState(0);
  const [avgScore, setAvgScore] = useState(0);
  const [qualitySessions, setQualitySessions] = useState(0);
  const [internalLoading, setInternalLoading] = useState(true);
  const [aliasLoaded, setAliasLoaded] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [noaCompleted, setNoaCompleted] = useState(false);
  const [preferredLang, setPreferredLang] = useState<string | null>(null);
  // undefined = never loaded; null = loaded for signed-out state; string = loaded for that uid
  const [loadedForUid, setLoadedForUid] = useState<string | null | undefined>(undefined);

  // Profile is "loading" when:
  //  1. Firebase auth hasn't settled yet, OR
  //  2. The Firestore fetch is in flight, OR
  //  3. The current user is different from the uid we last fetched for
  //     (this closes the one-render gap where load(null) cleared internalLoading
  //      but auth then resolved to a real user before load(user) could run)
  const loading = authLoading || internalLoading || loadedForUid !== (user?.uid ?? null);

  const load = useCallback(async () => {
    if (!user) { setInternalLoading(false); setAliasLoaded(true); setLoadedForUid(null); return; }
    setInternalLoading(true);

    // Check localStorage caches immediately — avoids redirect flashes when
    // Firestore is slow or a secondary read fails (see Promise.allSettled below).
    const localOnboarded    = localStorage.getItem(ONBOARDED_KEY(user.uid)) === "true";
    const localNoaCompleted = localStorage.getItem(NOA_KEY(user.uid))       === "true";
    if (localOnboarded)    setOnboarded(true);
    if (localNoaCompleted) setNoaCompleted(true);

    try {
      // Use allSettled so that a failure in any single read (trophies, convs…)
      // does NOT throw and leave onboarded stuck at false.
      const [aliasRes, levelRes, trophyRes, convsRes, userSnapRes] = await Promise.allSettled([
        getUserAlias(user.uid),
        getUserLevel(user.uid),
        getUserTrophies(user.uid),
        getHelperConversations(user.uid),
        getDoc(doc(db, "users", user.uid)),
      ]);

      const a         = aliasRes.status    === "fulfilled" ? aliasRes.value    : null;
      const levelData = levelRes.status    === "fulfilled" ? levelRes.value    : { level: "Semilla" as Level, isStar: false };
      const trophyList= trophyRes.status   === "fulfilled" ? trophyRes.value   : [];
      const convs     = convsRes.status    === "fulfilled" ? convsRes.value    : [];
      const userSnap  = userSnapRes.status === "fulfilled" ? userSnapRes.value : null;

      setAliasState(a);
      setAliasLoaded(true);
      setIsStar(levelData.isStar);
      setTrophies(trophyList);

      const userDoc = (userSnap?.exists() ? userSnap.data() : {}) as UserDoc;
      setStreak(userDoc.currentStreak ?? 0);
      setPreferredLang(userDoc.language ?? null);

      const firestoreOnboarded    = (userDoc.onboardingCompleted === true) || (userDoc.onboarded === true);
      const firestoreNoaCompleted = userDoc.noaCompleted === true;
      // Persist to localStorage whenever Firestore confirms, so future loads
      // succeed even if Firestore is slow or fails.
      if (firestoreOnboarded)    localStorage.setItem(ONBOARDED_KEY(user.uid), "true");
      if (firestoreNoaCompleted) localStorage.setItem(NOA_KEY(user.uid), "true");
      setOnboarded(firestoreOnboarded || localOnboarded);
      setNoaCompleted(firestoreNoaCompleted || localNoaCompleted);

      const scored  = convs.filter((c) => c.moderation?.score != null);
      const avg     = scored.length ? scored.reduce((s, c) => s + c.moderation!.score, 0) / scored.length : 0;
      const quality = convs.filter((c) => (c.moderation?.score ?? 0) >= 7).length;
      setAvgScore(avg);
      setQualitySessions(quality);

      const hasImpact = trophyList.some((t) => IMPACT_TROPHY_IDS.includes(t.id));
      setLevel(calculateLevel(quality, hasImpact, levelData.isStar));
    } finally {
      setInternalLoading(false);
      setLoadedForUid(user.uid);
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
      onboarded, noaCompleted, loading, aliasLoaded, preferredLang, refetch: load, setAlias,
      setOnboardedTrue: () => {
        setOnboarded(true);
        if (user) localStorage.setItem(ONBOARDED_KEY(user.uid), "true");
      },
      setNoaCompletedTrue: () => {
        setNoaCompleted(true);
        if (user) localStorage.setItem(NOA_KEY(user.uid), "true");
      },
    }}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  return useContext(UserProfileContext);
}
