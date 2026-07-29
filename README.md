# Gaming Stuff DZ — Backend API

Backend production-ready pour le site e-commerce **Gaming Stuff DZ**.
Node.js + Express + PostgreSQL (via Prisma ORM).

> ⚠️ Ce backend est un projet **séparé** de votre fichier `gaming-stuff-dz.html`.
> Le HTML actuel est une page statique côté client ; pour l'utiliser avec cette API,
> il faudra remplacer sa logique JS (panier en mémoire, produits codés en dur) par des
> appels `fetch()` vers ces endpoints. Voir la section "Brancher le frontend" plus bas.

## 1. Stack technique

| Besoin              | Choix                          | Pourquoi |
|----------------------|--------------------------------|----------|
| Serveur HTTP         | Express 4                      | Simple, mature, écosystème énorme, suffisant pour ce périmètre (pas besoin de la complexité de NestJS ici) |
| Base de données      | PostgreSQL                     | Relationnel, robuste, gère bien les transactions (commandes, stock) |
| ORM                  | Prisma                         | Migrations versionnées, typage, requêtes sûres (anti-injection SQL) |
| Auth                 | JWT (access court) + refresh token en cookie httpOnly | Stateless côté access token, révocable côté refresh |
| Validation           | Zod                            | Schémas déclaratifs, messages clairs |
| Mots de passe        | bcryptjs (12 rounds)           | Standard éprouvé |
| Emails               | Nodemailer (SMTP)              | Compatible avec n'importe quel fournisseur (Brevo, Mailgun, SES...) |
| Upload images        | Multer (mémoire) + Sharp        | Re-encodage systématique (supprime EXIF, empêche l'upload de fichiers malveillants déguisés en image) |
| Logs                 | Winston + Morgan               | Logs fichiers rotatifs + logs HTTP |
| Sécurité             | Helmet, cors, rate-limit, hpp, xss-clean, mongo-sanitize | Voir section dédiée |
| Tests                | Jest + Supertest               | Tests d'intégration sur les routes critiques |

## 2. Démarrage rapide

```bash
cd backend
cp .env.example .env        # puis remplissez les vraies valeurs
npm install

# Option A — avec Docker (recommandé, lance Postgres + API)
docker compose up --build

# Option B — en local avec un Postgres déjà installé
npx prisma migrate dev --name init
npm run seed                # crée un admin + les 3 produits réels
npm run dev
```

Compte admin créé par le seed : `admin@gamingstuffdz.com` / mot de passe défini dans `SEED_ADMIN_PASSWORD`.
**Changez ce mot de passe immédiatement après le premier déploiement.**

## 3. Sécurité mise en place

- **Mots de passe** : bcrypt (12 rounds), jamais renvoyés dans les réponses API.
- **Brute-force login** : verrouillage du compte 15 min après 5 échecs + rate-limit IP (10 tentatives / 15 min) sur les routes sensibles.
- **JWT** : access token courte durée (15 min) signé avec un secret fort ; refresh token opaque, stocké haché en base, en cookie `httpOnly` + `secure` + `sameSite=lax`, avec rotation à chaque refresh (empêche le rejeu si volé).
- **Injections SQL** : impossible via Prisma (requêtes paramétrées, pas de concaténation de chaînes).
- **XSS** : `xss-clean` nettoie les payloads dans body/query ; Helmet pose des en-têtes stricts (CSP de base, `X-Content-Type-Options`, etc.).
- **CSRF** : le cookie de refresh est `sameSite=lax` + l'API n'accepte que l'origine `CLIENT_URL` en CORS avec `credentials: true` ; les actions sensibles utilisent le header `Authorization` (non automatiquement envoyé par le navigateur, donc non exploitable en CSRF classique).
- **Pollution de paramètres** : `hpp`.
- **Validation stricte** : chaque route qui reçoit des données utilisateur passe par un schéma Zod ; toute donnée non conforme est rejetée en 422 avant d'atteindre la base.
- **Upload de fichiers** : type MIME vérifié, taille limitée, tout fichier est ré-encodé via Sharp (supprime tout code malveillant caché, supprime l'EXIF), nom de fichier régénéré aléatoirement (pas de path traversal).
- **RBAC** : chaque route sensible vérifie `req.user.role` via `restrictTo('ADMIN', ...)`.
- **Logs** : toute erreur serveur (5xx) et toute exception non gérée sont journalisées avec la pile d'appel, sans jamais exposer la stack au client en production.

## 4. Structure du projet

```
backend/
├── prisma/
│   ├── schema.prisma      # modèle de données complet
│   └── seed.js            # admin + produits de démo
├── src/
│   ├── config/            # env, logger, client Prisma
│   ├── middleware/         # auth, erreurs, rate-limit, upload, validation
│   ├── controllers/         # logique métier par domaine
│   ├── routes/             # définition des endpoints
│   ├── validators/          # schémas Zod
│   ├── utils/               # AppError, tokens, emails, pagination
│   ├── tests/                # tests Jest/Supertest
│   ├── app.js                # config Express (middlewares + routes)
│   └── server.js             # point d'entrée
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

## 5. Documentation de l'API

Base URL : `/api`. Toutes les réponses suivent le format :
```json
{ "status": "success" | "fail" | "error", "data": ..., "message": "...", "meta": { ... } }
```

### Authentification — `/api/auth`
| Méthode | Route | Description | Accès |
|---|---|---|---|
| POST | `/register` | Inscription | Public |
| POST | `/login` | Connexion (renvoie `accessToken` + cookie refresh) | Public |
| POST | `/refresh` | Renouvelle l'access token via le cookie | Public (cookie requis) |
| POST | `/logout` | Révoque le refresh token | Public |
| GET  | `/verify-email?token=...` | Confirme l'adresse e-mail | Public |
| POST | `/forgot-password` | Envoie un lien de reset | Public |
| POST | `/reset-password` | Définit un nouveau mot de passe | Public |
| GET  | `/me` | Profil courant | Connecté |
| PATCH | `/me` | Modifier son profil | Connecté |
| PATCH | `/change-password` | Changer son mot de passe | Connecté |

### Produits — `/api/products`
| Méthode | Route | Description | Accès |
|---|---|---|---|
| GET | `/?search=&category=&minPrice=&maxPrice=&sortBy=&order=&page=&limit=` | Liste filtrée/triée/paginée | Public |
| GET | `/:slug` | Détail produit (specs, variantes, avis) | Public |
| POST | `/` | Créer un produit | Admin/Modérateur |
| PATCH | `/:id` | Modifier un produit | Admin/Modérateur |
| DELETE | `/:id` | Désactiver un produit | Admin |
| POST | `/:id/images` | Upload d'images (`multipart/form-data`, champ `images`) | Admin/Modérateur |
| POST | `/:id/reviews` | Ajouter un avis (modéré avant publication) | Connecté |
| GET/POST/PATCH/DELETE | `/categories...` | Gestion des catégories | Public (GET) / Admin (autres) |

### Panier — `/api/cart` *(connecté)*
`GET /`, `POST /items`, `PATCH /items/:itemId`, `DELETE /items/:itemId`, `DELETE /`

### Commandes — `/api/orders` *(connecté)*
`POST /` (création depuis le panier, gère stock + coupon + facture + email), `GET /` (historique paginé), `GET /:id`

### Coupons — `/api/coupons`
`GET /:code/check` (public), CRUD admin sur `/`

### Administration — `/api/admin` *(Admin/Modérateur)*
`GET /dashboard`, `GET /users`, `PATCH /users/:id/role`, `PATCH /users/:id/status`, `GET /orders`, `PATCH /orders/:id/status`

## 6. Brancher le frontend existant

Le fichier `gaming-stuff-dz.html` actuel gère produits, panier et commande **entièrement en JavaScript côté client**, sans serveur. Pour connecter ce backend sans casser le design :

1. Remplacer l'objet `PRODUCTS` codé en dur par un `fetch('/api/products')` au chargement de la page, et générer les cartes dynamiquement avec les mêmes classes CSS.
2. Remplacer le tableau `cart` en mémoire par des appels à `/api/cart` (nécessite d'ajouter un vrai écran de connexion/inscription au site, actuellement absent).
3. Remplacer la simulation de commande par un `POST /api/orders`.
4. Ajouter un intercepteur qui rafraîchit l'`accessToken` via `/api/auth/refresh` quand il expire.

Cette étape d'intégration représente un travail frontend à part entière (ajout d'écrans de connexion, gestion d'état) que je peux faire ensuite si vous le souhaitez.

## 7. Tests

```bash
npm test
```
Couvre : inscription (validation, doublons), connexion (échecs, verrouillage), accès aux routes protégées/admin, liste produits (pagination, recherche, filtres), 404.

## 8. Déploiement en production — checklist

- [ ] Toutes les variables de `.env.example` renseignées avec de vraies valeurs (secrets générés avec `openssl rand -hex 64`)
- [ ] `NODE_ENV=production`
- [ ] Base PostgreSQL managée (Neon, Supabase, RDS...) avec sauvegardes automatiques
- [ ] `npx prisma migrate deploy` exécuté sur la base de prod
- [ ] Reverse proxy HTTPS (Nginx / Caddy / le load balancer du provider)
- [ ] `CLIENT_URL` pointant vers le vrai domaine du site (pour CORS)
- [ ] SMTP de production configuré et testé (email de vérification + reset)
- [ ] Mot de passe admin du seed changé
- [ ] Sauvegarde du dossier `public/uploads` (ou migration vers un stockage objet type S3 si le volume grossit)
