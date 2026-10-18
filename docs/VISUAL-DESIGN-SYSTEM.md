# SSDv2 Control — Refonte de la WebUI

> Statut : implémentation visuelle. Source officielle de marque : [projetssd/branding](https://github.com/projetssd/branding).

## Intention

Une console d'administration dense, claire, calme et fiable. Conserver toutes les fonctionnalités, informations et protections de SSDV2-WEBUI. Ne pas recréer la logique métier de SSDV2.

## Identité

- Nom officiel SSDv2, signature « Déployez. Gérez. Sécurisez. ».
- Les fichiers SVG de `frontend/public/branding/` sont des copies du Brand Kit généré depuis les maîtres. Ne **jamais** redessiner les rubans à la main.
- Bleu d'action #2563EB (clair), bleu #3B82F6 (sombre), violet #7C3AED et cyan #06B6D4 comme accents **non sémantiques**.
- Polices : Inter en priorité, Geist/system-ui en repli. Les polices sont chargées par CSS web dans `frontend/index.html`, sans font embarquée.
- Surface claire #F8FAFC, surface sombre #070F1E. État réel : vert succès, orange attention, rouge erreur.
- Respecter l'accessibilité (contrastes, navigation clavier, libellés, réduction des animations).

## Intégration technique

L'interface existante repose sur shadcn/ui + Tailwind 4 + next-themes. Les tokens du kit officiel sont adaptés aux variables shadcn dans `frontend/src/index.css` ; la classe `.dark` reste source unique du thème. Ne pas charger `theme.css` du dépôt Branding par-dessus cette couche, car ses sélecteurs `[data-theme]` introduiraient une source de vérité concurrente.

`frontend/src/components/app/brand-logo.tsx` utilise les logos horizontaux clairs/sombres selon le thème. Conserver le favicon, les logos et illustrations synchronisés avec les exports officiels.

## Principes d'interface

1. Navigation latérale stable et repliable sur ordinateur, zone défilante indépendante ; sur mobile, bouton flottant discret de type Material pour ouvrir une sidebar de type Sheet. Plus de barre d'onglets en bas.
2. Dashboard opérationnel : état, chiffres utiles, ressources et activité récente ; jamais une galerie décorative.
3. Catalogue : filtres en onglets compacts et tableau lisible ; actions existantes conservées.
4. Détail d'application : informations regroupées et hiérarchisées, onglets fonctionnels, actions du cycle de vie conservées.
5. Jobs : liste à gauche, détail/logs à droite sur desktop ; sur mobile, **une vue à la fois** : `/jobs` pour la liste et `/jobs/:id` pour le détail avec un lien de retour. Les messages et commandes SSE restent fonctionnels.
6. Une palette fonctionnelle indépendante de la marque pour les états Docker, les logs, les avertissements et les erreurs.
7. Ne jamais affaiblir les confirmations graduées des opérations dangereuses décrites dans `AGENTS.md` et le brief du projet.

## Contrôles avant publication

- `cd frontend && npm ci && npm run lint && npm run typecheck && npm run test && npm run build`.
- Vérifier les pages en clair/sombre et à 375, 768, 1280, 1920 px.
- Tester clavier, menu mobile, sidebar repliée, modal des actions critiques, consultation logs SSE et authentification externe.
- Exécuter la CI backend inchangée et le workflow Docker multiarchitecture avant d'annoncer une publication terminée.

## Responsive mobile et liens contextuels

- Sur les écrans inférieurs à 1024 px, les données tabulaires passent en **listes de cartes** (applications, conteneurs, authentification, mises à jour, sauvegardes, historique, audit, paramètres). Les tableaux denses sont conservés sur desktop ; pagination et filtres restent identiques.
- La présentation mobile n'altère aucune commande : boutons de cycle de vie, mises à jour, sélection d'authentification et confirmations conservent leurs mutations habituelles.
- Le composant `MobileCards` / `MobileCard` / `MobileField` centralise la structure responsive. Les labels explicites évitent d'avoir à deviner le sens des valeurs.
- `AppLink` construit uniquement des **liens internes** vers `/apps/:app`, jamais des URL d'accès public. Il est utilisé dans les sauvegardes, mises à jour, authentification, audit des actions applicatives, diagnostics et jobs. Les cibles qui ne sont pas des apps (conteneurs orphelins, opérations génériques) restent du texte.
- Pour un job applicatif, la navigation vers le job et la navigation vers l'application sont deux liens distincts, sans lien imbriqué.

## Jobs : prévention des débordements mobiles

- Sous le seuil desktop `lg` (1024 px), la liste et le détail sont mutuellement exclusifs, mais les deux panneaux restent affichés en parallèle sur ordinateur.
- La grille utilise `minmax(0,1fr)` sur mobile, tous les panneaux ont `min-w-0` et `max-w-full` ; les libellés de jobs, identifiants et erreurs très longs se coupent proprement.
- Les filtres de la liste sont présentés sur deux colonnes mobiles, la recherche prend toute la largeur disponible.
- Les logs conservent les espaces et sont défilables **horizontalement à l'intérieur du panneau**, sans augmenter la largeur de la page. La hauteur de la console est bornée sur smartphone.
- Les invites interactives restent accessibles : labels pouvant revenir à la ligne, boutons d'option adaptés, formulaire sans largeur minimale excessive.
- Le détail d'une URL directe `/jobs/:id` affiche aussi un retour vers la liste ; la barre de navigation inférieure reste dégagée.

## UX — navigation et hiérarchie (octobre 2026)

- Fiche application : retour au catalogue, indicateurs CPU/mémoire/conteneurs sur mobile et trois onglets principaux. Les rubriques volumes, réseau, variables et historique sont dans « Plus » sous 1024 px ; les sept onglets restent disponibles sur ordinateur.
- Actions applicatives : ouvrir et redémarrer (ou démarrer à l'arrêt) immédiatement ; arrêt, sauvegarde et mutations avancées dans le menu existant. Les confirmations graduées et demandes de nom en cas de suppression des données restent obligatoires.
- Catalogue : filtres sur une seule ligne défilable sur mobile, recherche en pleine largeur, réinitialisation accessible et cartes compactes.
- Dashboard : quatre compteurs en 2 × 2 sur mobile ; informations hôte détaillées masquées sur mobile mais toujours accessibles dans Santé système. Alertes recentrées sur les erreurs/avertissements non lus.
- Recherche : icône mobile avec dialogue dédié, recherche partagée avec desktop, raccourci Cmd/Ctrl+K préservé.
- Notifications : filtres Toutes et Non lues, regroupement par date, accès direct à la fiche applicative lorsque le job lié est identifié.
- Divers : états vides uniformisés, skeleton adaptés aux petits écrans et dimensions tactiles minimales pour les boutons sur mobile.

## Navigation latérale robuste et FAB en verre (octobre 2026)

- `AppSidebar` est un composant unique pour desktop et mobile. Ses trois régions sont indépendantes : en-tête/logo, navigation défilante (`min-h-0`, `overflow-y-auto`, inertie tactile iOS, `overscroll-y-contain`) et statut de bas de panneau.
- Desktop : sidebar sticky, hauteur `100dvh`, rétractable en icônes ; les liens restent accessibles au clavier via leur nom.
- Mobile/tablette : panneau dans un `Dialog` Base UI (focus géré, fermeture Échap/fond/fermeture explicite et blocage du scroll de l'arrière-plan), largeur limitée à l'écran, pied de page respectant les marges iOS. Fermeture automatique à la navigation et au passage desktop.
- Le menu bas à quatre destinations est supprimé ; un bouton flottant circulaire à effet verre (clair et sombre) le remplace en bas à gauche, à `8.5rem` + safe area du bas pour laisser de la place aux notifications. Il ouvre le même panneau mobile que le bouton hamburger du haut.
- Hamburger et recherche de la top bar : zones tactiles 48 × 48 px et icônes 24 px. La search modale dédiée sous 768 px est conservée.
- Test visuel recommandé à 320/375/430 px, paysage, Safari iOS, contenu long, clavier virtuel, réduction d'animations et notifications Sonner ; ne jamais affirmer une validation appareil tant qu'elle n'a pas eu lieu.

## Correctif Safari iOS et navigation (octobre 2026)

- Sheet mobile basé sur Base UI Dialog, selon le pattern shadcn/ui : positionnement à gauche sans héritage de transforms centrés. Zone de menu défilante indépendante conservée. Largeur limitée à l'écran.
- Suppression du style personnalisé `control-sidebar-drawer` et du bouton `control-glass-fab`. Le bouton de navigation utilise les classes existantes shadcn : rond, sobre, 48 px, avec ombre discrète et marge inférieure compatible safe area.
- Boutons menu/recherche de top bar : 40 px et icônes 20 px. Titre contextualisé sur mobile (nom de rubrique, application ou job).
- Top bar mobile automatiquement masquée après une descente d'au moins 20 px cumulés, réapparition lors de la remontée et à proximité du haut ; maintenue visible quand un menu ou une recherche est ouvert. Desktop inchangé.
- Le comportement conserve la gestion focus, le défilement, Échap et la réduction d'animations ; les tests automatisés ne remplacent pas la validation visuelle sur un iPhone réel.

## Évolution « Modules & Flow » — source officielle SSDv2

**Source de vérité :** [projetssd/branding](https://github.com/projetssd/branding) — `source/symbol-master.svg`, `source/wordmark-master.svg`, `design-system/tokens.json`, `docs/brand-guidelines.md` et `assets/illustrations/*.svg`. Ne pas redessiner les rubans du logo ; les accents CSS (ligne trois couleurs) ne sont pas le logo et ne doivent pas être substitués au logotype.

### Règles

- **Sombre par défaut** : `next-themes` utilise `defaultTheme=dark`, système désactivé. La préférence explicite sauvegardée sous `ssdv2-theme` reste prioritaire ; le bouton clair/sombre demeure. L'HTML démarre avec `.dark` pour limiter le flash avant hydratation.
- **Primitives de marques** : `BrandHero`, `BrandPanel`, `BrandSectionHeading`, `BrandStatusRail`, `MetricCard` et `BrandAppCard`; styles séparés sous `frontend/src/ssdv2-brand.css`. Contrôles, formulaires, popovers, Sheet et alert-dialog restent des composants shadcn/Base UI.
- **Signal, pas décoration** : ligne tricolore cyan → bleu → violet pour en-têtes et modules. Elle ne représente jamais l'état d'une application. Vert/ambre/rouge exclusivement pour succès/avertissement/erreur.
- **Surfaces** : modules peu élevés avec bordures nettes, contenus denses, titres plus techniques et chiffres monospace. Ne pas poser de dégradés sur toutes les cartes. Les logos SVG sont conservés à l'identique.
- **Illustrations** : copies exactes des cinq illustrations officielles dans `frontend/public/branding/illustrations/`; l'illustration Administration habille le Dashboard, État vide intervient sur les listes vides. Images purement décoratives avec `alt=""` ; ne remplacent jamais un statut textuel.
- **Apps** : cartes mobiles spécifiques avec indicateur vertical sémantique, icône neutre, nom, état, domaine, conteneurs et actions existantes ; desktop reste tableau. La fiche utilise les surfaces modulaires, sans toucher aux actions ni aux confirmations.
- **Jobs** : liste conçue en flux temporel avec des marqueurs correspondant au vrai statut ; console de logs et saisies sensibles restent inchangées. Les contrôles tactiles et les liens directs vers les applications sont conservés.
- **Accessibilité et mouvement** : focus visible, labels et couleurs contrastées, animations réduites, préférences système de réduction d'animation respectées. Tester sur Safari iPhone, mobile 320–430px et desktop clair/sombre avant d'affirmer une validation visuelle complète.

### Validation du kit graphique

`projetssd/branding` signale que l'emblème a été reconstruit depuis une référence raster approuvée, et non extrait de vecteurs originaux. Les exports officiels sont l'unique source utilisable dans la WebUI. Toute retouche au symbole doit se faire dans les fichiers maîtres du dépôt Branding et être régénérée depuis les scripts officiels.

## Harmonisation des rubriques — octobre 2026

Cette tranche décline **Modules & Flow** dans les écrans d'administration sans modifier leurs opérations.

- **Santé système** : tuiles de mesures en deux colonnes mobiles, contrôles regroupés, services marqués par leur état réel (ok/degraded/unknown). Aucun seuil CPU ou mémoire inventé.
- **Sauvegardes** : compteur d'archives et historique, cartes avec icône et liens vers les applications ; tableau desktop conservé.
- **Mises à jour** : en-tête récapitulatif, distinction des versions et états disponibles/à jour ; actions identiques.
- **Authentification** : compteur des applications déclarées protégées, modification groupée séparée des entrées, confirmation inchangée.
- **Diagnostics** : compteur des anomalies observées, cartes différenciant anomalie et état normal. Nettoyages et confirmations par SUPPRIMER préservés.
- **Notifications** : fil par date, repère de sévérité et filtres/liens inchangés.
- **Paramètres / Sécurité** : modules structurés, focus des modes de sécurité, verrouillages et mots de passe conservés.
- **Audit** : journal technique et cartes mobiles cohérentes.
- **Jobs** : chronologie établie uniquement depuis les horodatages réels (création, début, fin) ; console SSE, invites et actions inchangées.
- **Transversal** : cartes mobiles avec accent SSDv2 discret, styles isolés dans ssdv2-brand.css. Les couleurs ne remplacent jamais les textes d'état.

**Invariants :** le Sheet iPhone, le défilement indépendant de la sidebar, la top bar intelligente, la préférence thème clair mémorisée et les confirmations destructrices restent inchangés. Tests automatisés et build ne remplacent pas une validation visuelle sur Safari iOS.
