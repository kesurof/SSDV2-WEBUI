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

1. Navigation latérale stable sur desktop, repliable en icônes avec titres explicites ; navigation inférieure sur mobile et accès au menu complet.
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
