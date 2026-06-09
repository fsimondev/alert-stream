# LiveWatch — alertes de live Twitch & Kick

Extension Chrome (Manifest V3) qui **notifie en temps réel quand un stream Twitch ou Kick démarre**, sans faire d'appels HTTP en boucle. La détection repose sur du **push WebSocket**, pas sur du polling.

- 🟣 **Twitch** : OAuth + **EventSub** via WebSocket (officiel) → abonnement `stream.online` / `stream.offline`.
- 🟢 **Kick** : **Pusher** WebSocket public → événement `App\Events\StreamerIsLive`. Aucune connexion requise.
- 🔔 Notification système (clic = ouvrir le live), **son d'alerte**, **badge** compteur de lives sur l'icône.
- 🎨 UI sombre néon (React + Tailwind), popup + page de réglages.
- ✅ Testé de bout en bout : **57 tests unitaires (Vitest)** + **7 tests E2E (Playwright)** qui chargent réellement l'extension dans Chromium.

> Pourquoi « zéro polling » ? Les seules requêtes HTTP sont **ponctuelles et événementielles** : résoudre l'id d'une chaîne une fois, créer les abonnements, et enrichir le titre au moment où le live démarre. Le reste du temps, on attend des messages poussés par le serveur sur une WebSocket.

---

## Installation (extension non empaquetée)

```bash
npm install
npm run build      # génère les assets puis construit dans dist/
```

Puis dans Chrome :

1. Ouvre `chrome://extensions`
2. Active le **Mode développeur** (en haut à droite)
3. **Charger l'extension non empaquetée** → sélectionne le dossier **`dist/`**

L'icône LiveWatch apparaît dans la barre d'outils.

---

## Utilisation

1. Clique l'icône pour ouvrir le **popup**.
2. Choisis **Twitch** ou **Kick**, colle une URL (`twitch.tv/xqc`, `kick.com/trainwreckstv`) ou juste un pseudo, puis **Ajouter**.
3. Quand une chaîne passe en live, tu reçois une notification (+ son + badge).

Réglages disponibles : son d'alerte (+ volume + bouton *Tester*), ouverture au clic, badge sur l'icône, et activation/son par chaîne.

---

## Scripts

| Commande | Description |
|---|---|
| `npm run dev` | Vite en mode dev (HMR) |
| `npm run build` | Build de production dans `dist/` |
| `npm run gen:assets` | Régénère les icônes PNG + le son d'alerte (par code) |
| `npm run typecheck` | Vérification TypeScript |
| `npm test` | Tests unitaires (Vitest) |
| `npm run test:cov` | Tests unitaires + couverture |
| `npm run e2e` | Tests E2E (Playwright, charge `dist/` dans Chromium) |

> Avant `npm run e2e`, lance `npm run build` (les E2E chargent le dossier `dist/`) et, la première fois, `npm run e2e:install` pour télécharger Chromium.

---

## Architecture

```
src/
  manifest.config.ts        # Manifest MV3 (CRXJS)
  background/
    index.ts                # Service worker : lifecycle, alarmes, messages, clic notif
    engine.ts               # Orchestrateur : storage <-> watchers <-> effets
    twitch-watcher.ts       # WebSocket EventSub + (re)création des abonnements
    kick-watcher.ts         # WebSocket Pusher + abonnement channel.<id>
    effects.ts              # Notifications, badge, audio offscreen
    decide.ts               # Décisions pures (notifier ? texte du badge) — testé
    commands.ts             # Intentions UI -> mutations storage -> reconcile
  offscreen/offscreen.ts    # Joue le son (un SW MV3 ne peut pas jouer d'audio)
  lib/
    twitch/ kick/           # Parsers purs + appels HTTP (resolve, helix, oauth)
    storage.ts messaging.ts parse-input.ts streamers.ts types.ts
  ui/                       # Hooks d'état + composants React partagés
  popup/  options/          # Pages React
tests/
  unit/                     # Vitest (parsers, storage, décisions, composants)
  e2e/                      # Playwright (extension chargée dans Chromium)
```

### Détails techniques notables

- **Survie du service worker (MV3)** : le SW s'endort après ~30 s d'inactivité. Le trafic WebSocket (keepalive Twitch ~10 s, ping/pong Pusher) le maintient éveillé ; une alarme `chrome.alarms` (toutes les 30 s) sert de filet et reconnecte toute socket morte.
- **Son** : impossible depuis un service worker → on utilise un **document offscreen** (`chrome.offscreen`).
- **Reconnexion** : chaque watcher détecte les sockets mortes/obsolètes et se reconnecte ; les abonnements EventSub sont recréés à chaque nouvelle session.
- **Snapshot au démarrage** : à la connexion, l'état live courant est récupéré une fois et appliqué **sans** déclencher de notification (pas de spam au lancement).

### Limite connue (Kick)

Le suivi Kick utilise le flux **Pusher public** du site (non documenté officiellement). C'est fiable aujourd'hui mais peut casser si Kick modifie son implémentation. L'API Kick officielle, elle, ne fonctionne que par *webhooks* (serveur public requis), donc inadaptée à une extension sans backend.

---

## Stack

React 18 · Vite 5 · CRXJS · Tailwind 3 · TypeScript · Vitest · Playwright · lucide-react
