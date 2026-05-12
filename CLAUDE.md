# People4People — Developer Reference

## Tech Stack
- React + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- Firebase (Auth, Firestore, Hosting, Cloud Functions)
- ElevenLabs TTS (VITE_ELEVENLABS_API_KEY)
- Claude API (VITE_ANTHROPIC_API_KEY)

## Entry Flow

**Public routes** (no auth required): `/`, `/gallery`, `/talk/:id`, `/create`

1. **Landing (`/`)** — Split-screen. Left = Gallery, Right = Create. Public.
2. **Gallery (`/gallery`)** — Browse all characters. Public. No login needed.
3. **Conversation entrada (`/talk/:id`)** — Portrait + opening line. Public.
   - Clicking "Descubrir su historia" → if not logged in, shows `LoginModal` in-place.
   - After sign-in (popup, stays on same page) → `AliasSelector` overlay appears if first time.
   - After alias selection → user can enter the conversation.
4. **Create (`/create`)** — Shows `LoginModal` fullscreen if not authenticated.

**Onboarding = login + alias only.** No Welcome page, no Noa step.
- `AliasSelector` shows as a full-screen overlay for logged-in users without an alias.
- Language is auto-detected from `navigator.language`; saved to localStorage + Firestore.
- `markOnboarded` is called from `AliasSelector` after alias confirmation.

**Protected routes** (redirect to `/login`): `/profile`, `/subscribe`, `/edit/:id`
**Moderator only**: `/dashboard`
**Legacy**: `/welcome` redirects to `/`

## Noa / Intro Character

Noa (`id: "__intro__"`) is defined in `src/data/introCharacter.ts` and included in the `characters` array in `src/data/characters.ts` as the first entry. She appears in the gallery exactly like any other character.

- Conversations with Noa **do not save to Firestore** — `isDemo` is true when `id === "__intro__"`.
- The `/demo` route (moderator-only shortcut) also uses Noa via `demoCharacter` prop.
- `noaCompleted` field is **removed** — do not use it.

## Key Architecture

### Auth & Identity
- `AuthContext` — Firebase auth state, `isModerator` check
- `UserProfileContext` — alias, level, trophies, streak, `onboarded` flag
- `AliasGate` in `App.tsx` — shows `AliasSelector` overlay when `user && !alias`
- Moderator email: `marcportellg@gmail.com` (in `firebase.ts`)

### Language
- Supported UI languages: `en`, `es`, `fr`, `it`
- Default: auto-detected from `navigator.language`, fallback `en`
- Persisted in `localStorage` + Firestore `users/{uid}.language`
- `LangSync` in App.tsx syncs Firestore preference on load (cross-device)

### Characters
- Hardcoded test characters: `src/data/characters.ts` (includes Noa first)
- User-created characters: Firestore `characters` collection
- `getCharacter(id)` searches the hardcoded array synchronously

### Conversations
- `isDemo = !!demoCharacter || id === "__intro__"` — no Firestore saving
- Timer: 3 min for demo, 15 min for real conversations
- Three phases: `entrada` (portrait + opening) → `conversacion` (chat) → `cierre` (tags + summary)
- `handleEnterConversacion` guards: requires auth unless `isDemo`

### Voice
- ElevenLabs voices indexed by language (`en`, `es`, `fr`, `it`)
- Language derived from character location: `locationToLang(location)` in `src/lib/voice.ts`
- Browser TTS fallback when ElevenLabs key not set

### Push Notifications
- VAPID keys in `.env.local` and `functions/.env`
- Service worker: `public/sw.js`
- Cloud Functions (4): `notifyHelperOnImpact`, `notifyHelperTrophy`, `onCharacterStatsChange`, `checkStaleCharacters`
- `PushPermissionPrompt` shown after first completed (non-demo) conversation

## Deploy
```bash
npm run build && firebase deploy --only hosting
firebase deploy --only functions   # requires Blaze plan
```
