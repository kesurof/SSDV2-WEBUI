# Audit de sécurité via SSDv2 Security Watch

La WebUI offre une entrée **Exploitation → Audit de sécurité** pour exporter
à la demande un inventaire Docker compatible avec le site
[SSDv2 Security Watch](https://ssdv2-security-watch-public.kesurof.workers.dev/).

## Fonctionnement

1. Depuis la WebUI connectée, choisir **Générer et télécharger**.
2. L'API `GET /api/v1/security-watch/inventory` inspecte les conteneurs Docker
   **en lecture seule**, après authentification par la WebUI. Elle télécharge
   `ssdv2-security-inventory.json` avec `Cache-Control: no-store`.
3. Ouvrir Security Watch et y déposer le fichier. **Aucun téléversement**
   automatique n'a lieu. L'analyse est effectuée dans le navigateur.

L'inventaire est limité aux **noms de conteneurs et applications, images,
digest/label de version déclarée, ports publiés (sans adresses IP), privilèges
et présence du socket Docker**. Il ne contient **ni variables d'environnement,
ni secrets, ni adresses IP, ni chemins de montages de l'hôte**, ni identifiants
réseau. Pas de fichier temporaire écrit sur disque, ni commande shell.

La génération n'est pas lancée en tâche de fond : uniquement à la demande.
Si Docker n'est pas accessible ou si le plafond de 500 conteneurs est dépassé,
l'API retourne HTTP 503, sans produire de rapport incomplet ni afficher
l'erreur détaillée du moteur Docker.

## Confidentialité et limites

Le téléchargement divulgue volontairement à l'utilisateur authentifié des
noms d'images, conteneurs et ports pouvant être sensibles. **Ne pas publier
ce JSON**. Le site public ne stocke pas ce rapport. Une version OCI peut être
différente de la version logicielle ; un port publié n'est pas une preuve
d'accessibilité depuis Internet. Pour mieux qualifier les versions et
dépendances, utiliser en complément un SBOM CycloneDX avec PURL.

L'API reste soumise au mode d'authentification interne ou proxy existant.
L'export n'est jamais proposé sur une route publique et n'ajoute aucune
capacité de modification Docker.

## Validation

- `backend/tests/test_api_security_watch.py` : authentification,
  compatibilité de format, protection des secrets, Docker inaccessible,
  refus des exports incomplets.
- `frontend/src/features/security-watch/SecurityWatchPage.test.tsx` :
  téléchargement et navigation sûre vers Security Watch.
