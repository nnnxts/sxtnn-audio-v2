# SXTNN AUDIO + SXTNN DISTRO

Application de streaming musical (**SXTNN AUDIO**) avec son portail de distribution intégré (**SXTNN DISTRO**, adresse `/distro`).
Tout tourne dans **un seul projet** et sur **un seul port** : le site, l'API et les fichiers audio.

---

## 1. Lancer le site sur votre PC (Windows 11 + VS Code)

### Étape 1 — Installer Node.js 22 (une seule fois)
1. Allez sur https://nodejs.org/dist/latest-v22.x/ et cliquez sur le fichier qui se termine par **`-x64.msi`**.
2. Lancez-le, cliquez sur « Next » jusqu'à la fin (laissez toutes les options par défaut).
3. Redémarrez VS Code après l'installation.

> ⚠️ Utilisez bien **Node 22**. Avec une version plus récente (26 par exemple), `npm install` échoue sur `better-sqlite3`.

### Étape 2 — Ouvrir le projet dans VS Code
1. Dézippez `sxtnn-audio.zip` (clic droit → « Extraire tout… »).
2. Dans VS Code : **Fichier → Ouvrir le dossier…** et choisissez le dossier `sxtnn-audio`.

### Étape 3 — Installer et démarrer
1. Dans VS Code : menu **Terminal → Nouveau terminal**.
2. Tapez cette commande puis Entrée (patientez, ça télécharge les outils) :
   ```
   npm install
   ```
3. Puis :
   ```
   npm run dev
   ```
4. Ouvrez http://localhost:5173 dans votre navigateur. Le site s'affiche.
5. Pour publier de la musique : allez sur http://localhost:5173/distro, tapez un nom d'artiste, et c'est parti.

Pour arrêter : dans le terminal, touches **Ctrl + C**.

> Vos données (base de données + fichiers audio/images) sont créées dans le dossier `data/` à la racine du projet.

### Tester la version « production » en local (optionnel)
```
npm run build
npm start
```
Puis ouvrez http://localhost:3000.

---

## 2. Mettre le site en ligne avec GitHub + Railway

### Étape 1 — Envoyer le projet sur GitHub
1. Créez un compte sur https://github.com puis cliquez sur **New repository** (nom : `sxtnn-audio`, laissez « Private »).
2. Dans le terminal de VS Code :
   ```
   git init
   git add .
   git commit -m "SXTNN AUDIO"
   git branch -M main
   git remote add origin https://github.com/VOTRE-PSEUDO/sxtnn-audio.git
   git push -u origin main
   ```
   (remplacez `VOTRE-PSEUDO` par votre pseudo GitHub).

Les dossiers `node_modules`, `dist` et `data` ne sont **pas** envoyés (c'est voulu, voir `.gitignore`).

### Étape 2 — Créer le service sur Railway
1. Sur https://railway.app : **New Project → Deploy from GitHub repo** → choisissez `sxtnn-audio`.
2. Railway détecte tout seul la configuration (fichier `railway.json`). Laissez-le construire.

### Étape 3 — Ajouter le Volume (INDISPENSABLE)
Sans volume, **tout est effacé à chaque redéploiement** (musiques, comptes, base de données).
1. Dans votre projet Railway, cliquez sur le service `sxtnn-audio`.
2. Cliquez sur **+ New** (ou clic droit sur le canevas) → **Volume**.
3. Rattachez-le au service et mettez comme **Mount path** : `/data`
4. Allez dans l'onglet **Variables** du service et ajoutez :
   - `DATA_DIR` = `/data`
   - (recommandé) `JWT_SECRET` = une longue phrase aléatoire de 32 caractères ou plus
5. Railway redéploie automatiquement.

### Étape 4 — Obtenir l'adresse publique
Onglet **Settings → Networking → Generate Domain**. Votre site est en ligne à cette adresse ; le portail est sur `https://votre-adresse/distro`.

---

## 3. Sauvegarder et restaurer

### Sauvegarder
Dans `/distro` → onglet **Catalogue & Gestion** → bouton **Télécharger un Backup Complet (.zip)**.
Le zip contient `database.sqlite` + tout le dossier `uploads/`.

### Restaurer (ou migrer vers un nouveau serveur) : avec le bouton
1. Déployez le site sur le nouveau serveur (nouveau volume monté sur `/data`).
2. Sur Railway, ajoutez la variable **`ADMIN_KEY`** (un mot de passe de votre choix, long) : sans elle la restauration est désactivée en ligne, par sécurité.
3. Allez sur `/distro` → **Catalogue & Gestion** → carte **Restaurer un backup**.
4. Choisissez le zip, tapez la clé admin, cliquez sur **Restaurer**, puis tapez `RESTAURER` pour confirmer.
5. Le site remplace tout son contenu (comptes, sorties, sons, pochettes, canvas) par celui du zip, puis vous ramène sur `/distro`.

Un backup d'une ancienne version du site (sans canvas) se restaure aussi : les canvas restent simplement vides.

> Si `ADMIN_KEY` est définie, elle est aussi demandée pour **télécharger** un backup. Sans `ADMIN_KEY`, n'importe quel artiste connecté peut télécharger un backup, ce qui contient aussi les e-mails des comptes : je vous conseille donc de la définir.

---

## 4. Les Canvas (courtes vidéos en boucle)

- Facultatif, **par sortie** (utilisé pour tous les morceaux sans canvas propre) et/ou **par morceau** (prioritaire).
- Format : vidéo verticale 9:16 (par exemple 720×1280), **MP4 (H.264) ou WebM**, **8 secondes maximum**, **15 Mo maximum**, sans son.
- Le canvas s'affiche dans le lecteur : bouton « clap » (**En lecture**) à droite de la barre du bas. Un point coloré indique que le morceau en cours a un canvas.
- Il ne se charge que lorsque le panneau est ouvert : aucun impact sur le reste du site.

---

## 4 bis. Utiliser le site comme une vraie application sur téléphone

Le site est pensé « app » sur mobile : barre de navigation en bas (Accueil, Explorer, Cœurs, Playlists, **Moi**), mini-lecteur flottant, **lecteur plein écran** (touchez le mini-lecteur ; glissez vers le bas ou utilisez le bouton « retour » d'Android pour le fermer), paroles et file d'attente dans le lecteur, canvas en fond du lecteur, vibrations légères au toucher (Android), pas de zoom parasite dans les champs.

**Installer sur l'écran d'accueil** (le site doit être en ligne, en HTTPS, donc sur Railway) :

- **Android (Chrome)** : ouvrez le site → menu ⋮ en haut à droite → **Installer l'application** (ou « Ajouter à l'écran d'accueil »).
- **iPhone (Safari uniquement)** : ouvrez le site → bouton **Partager** (carré avec une flèche) → **Sur l'écran d'accueil** → Ajouter.

Une fois installé, le site s'ouvre en plein écran, sans barre d'adresse, avec l'icône SXTNN.

Limites honnêtes : l'installation ne fonctionne qu'en ligne (pas de mode hors connexion pour la musique). Sur iPhone, la lecture peut se couper si l'application reste très longtemps en arrière-plan ou si l'écran est verrouillé longtemps, c'est une limite d'iOS. Les vibrations ne fonctionnent pas sur iPhone.

---

## 5. ⚠️ Points d'attention

- **Ancienne version déjà sur Railway** : le schéma de base de données est différent. **Ne branchez pas le nouveau code sur l'ancien volume/ancienne base sans backup.** Déployez plutôt dans un *nouveau* service avec un *nouveau* volume. Pour récupérer vos anciennes données, il faudra un script de migration : il faut pour cela me fournir la structure (ou une copie) de l'ancienne base.
- **Connexion artiste protégée par code** : « Accès Artiste » demande d'abord le **code d'accès** (la variable `ADMIN_KEY`, le même que pour télécharger/restaurer un backup), puis le nom d'artiste comme avant. Sans `ADMIN_KEY`, l'accès reste libre. 8 mauvais essais bloquent l'adresse pendant 10 minutes. Les anciennes sessions artiste ouvertes avant l'ajout du code sont refusées (il faut se reconnecter une fois).
- **Fichiers uploadés** : audio (mp3, wav, flac, ogg), images (jpg, png, webp…) et canvas (mp4, webm). Taille maximale : 400 Mo par fichier audio ou image (réglable dans `server/upload.js`), 15 Mo par canvas.

---

## 5 bis. Nouveautés (amis, sorties privées, paroles, thèmes)

- **Sortie à la une** : c'est toujours la dernière sortie publique (hors leaks) **créée ou modifiée** (nouveau titre ajouté, infos changées, paroles ajoutées…).
- **Amis & sorties privées** : Distro → onglet **Amis** → « Créer un lien d'invitation » (usage unique, valable 7 jours). La personne ouvre le lien, se connecte à son compte puis accepte. Dans le formulaire de publication, choisissez **« Amis uniquement »** : seuls l'artiste et ses amis voient et écoutent la sortie (accueil, recherche, explorer, page artiste, paroles, fichiers audio/canvas). La liste d'amis n'est visible que dans le portail de l'artiste.
  Les pochettes d'une sortie privée gardent une adresse impossible à deviner mais ne sont pas protégées par un jeton : ne mettez pas d'information sensible dans une pochette.
- **Paroles synchronisées** : Distro → Catalogue → bouton **Paroles** d'une sortie déjà publiée → écoutez et appuyez sur « TOP » (ou la barre d'espace) à chaque début de ligne. Stockage au format LRC dans le même champ « paroles » ; un texte sans horodatage reste un texte simple.
- **Thèmes** : 40 thèmes en tout (Apparence → Classiques, Rétro & Aero, plateformes, ambiances, inspirés d'albums). Option « Couleur des boutons » (par appareil) et « Adapter à la pochette » (page d'une sortie / barre de lecture).
  - **Décors animés** (très légers, uniquement transform/opacity) : **Frutiger Aero** (nuages, bulles qui montent, herbe qui ondule), **Frutiger Metro** (style vecteur Y2K : cercles, tache d'encre, étoiles, couleurs qui glissent ; deux haut-parleurs qui pulsent pendant la lecture et s'arrêtent en douceur ; étincelles visibles seulement pendant la lecture), **Vaporwave** (grille qui défile, soleil qui pulse), **Mac Rétro 80s** (soleil rayé, sol en damier qui défile). Le rythme des haut-parleurs est simulé, pas calé sur le tempo du morceau. Apparence → **Performance → Animations du fond** les coupe d'un clic (appareil lent).
  - **Page artiste** : sur les thèmes à décor de fond, la bannière devient une carte arrondie avec un voile sombre propre (au lieu du fondu qui laissait une bande dure). Les thèmes classiques sont inchangés.
  - **Windows 7** (l'ancien « Windows XP », renommé, même identifiant interne) et un vrai **Windows XP** (Luna, colline verte, bouton vert). L'ancien Metro aqua reste disponible sous le nom **Metro Aqua**.
  - **Inspirés d'albums, tous animés** (palettes et motifs originaux, pas de copie des pochettes ; code dans `src/albums.css` et `src/lib/albumGen.ts`) : **Pink Tape** (drapeau rose qui ondule, étoiles qui scintillent), **Whole Lotta Red** (rouge qui coule, grain qui tremble), **Fancy That** (rouge grunge, couronne dorée, pétales de rose), **The Life of Pablo** (lignes de texte noir qui défilent sur aplat saumon), **Graduation** (ciel violet-rose, anneaux, toques qui tombent), **Astroworld** (ciel bleu, guirlande, grande roue qui tourne, pop-corn, soleil doré), **More Chaos** (mur de plâtre, éclaboussures de sang).
  - **Thèmes rétro ajoutés** : **Windows 95** (gris en relief, bleu marine), **Winamp** (barres LED qui suivent la lecture et retombent à la pause), **Game Boy** (quatre verts, pixels), **iMac G3** (bleu Bondi, bonbons translucides).
- **Sauvegardes** : les nouvelles tables `friendships` et `friend_invites` sont incluses dans les backups.

---

## 6. Où se trouve quoi

| Dossier / fichier | Rôle |
|---|---|
| `server/` | Back-end Express : API (`/api`), streaming audio (`/media`), SQLite |
| `src/` | Front-end React (pages, lecteur, thèmes, portail Distro) |
| `data/` | Créé automatiquement : base de données + uploads (jamais envoyé sur GitHub) |
| `railway.json` | Configuration de déploiement Railway |
| `.env.example` | Exemple de variables d'environnement |

### Variables d'environnement
| Variable | Rôle | Par défaut |
|---|---|---|
| `PORT` | Port du serveur (Railway le fournit) | `3000` |
| `DATA_DIR` | Dossier des données persistantes | `./data` (`/data` en production si présent) |
| `JWT_SECRET` | Clé de signature des sessions | générée et stockée dans `DATA_DIR` |
| `ADMIN_KEY` | Code d'accès : entrer dans « Accès Artiste » + télécharger / restaurer un backup (recommandé en ligne, obligatoire pour restaurer) | aucune |
