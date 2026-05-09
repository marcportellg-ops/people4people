import { signInWithPopup, signOut, onAuthStateChanged, type User, type UserCredential } from "firebase/auth";
import { auth, googleProvider, SUPER_MODERATOR_EMAIL } from "./firebase";

export async function signInWithGoogle(): Promise<UserCredential> {
  return signInWithPopup(auth, googleProvider);
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export function isSuperModerator(user: User | null): boolean {
  return user?.email === SUPER_MODERATOR_EMAIL;
}

export { onAuthStateChanged, auth };
export type { User };
