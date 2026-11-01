import { Download, ExternalLink, ShieldCheck } from 'lucide-react'

import { apiUrl } from '@/api/url'
import { BrandPanel } from '@/components/app/brand-panel'
import { PageHeader } from '@/components/app/page-header'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const WATCH_URL = 'https://ssdv2-security-watch-public.kesurof.workers.dev/'

export function SecurityWatchPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Audit de sécurité"
        subtitle="Exportez un inventaire de votre serveur pour l'analyser dans SSDv2 Security Watch."
      />
      <BrandPanel as="section" className="space-y-4 p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" aria-hidden />
          <h2 className="text-base font-semibold">Diagnostic local en deux étapes</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="min-w-0 rounded-lg border bg-secondary/30 p-4">
            <span className="ssdv2-eyebrow">01 · SUR CE SERVEUR</span>
            <h3 className="mt-2 text-sm font-semibold">Télécharger l'inventaire</h3>
            <p className="my-2 text-xs leading-relaxed text-muted-foreground">
              Lecture seule de Docker : images, versions déclarées, ports et privilèges.
              Aucun mot de passe ni variable d'environnement.
            </p>
            <a
              href={apiUrl('/security-watch/inventory')}
              download="ssdv2-security-inventory.json"
              className={cn(buttonVariants({ variant: 'default', size: 'lg' }), 'mt-2 no-underline')}
            >
              <Download className="size-4" aria-hidden />
              Générer et télécharger
            </a>
          </div>
          <div className="min-w-0 rounded-lg border bg-secondary/30 p-4">
            <span className="ssdv2-eyebrow">02 · DANS LE NAVIGATEUR</span>
            <h3 className="mt-2 text-sm font-semibold">Analyser les risques</h3>
            <p className="my-2 text-xs leading-relaxed text-muted-foreground">
              Ouvrez Security Watch puis déposez le JSON téléchargé.
              Le fichier reste dans votre navigateur.
            </p>
            <a
              href={WATCH_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'mt-2 no-underline')}
            >
              <ExternalLink className="size-4" aria-hidden />
              Ouvrir Security Watch
            </a>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Ce rapport identifie des points à vérifier, sans certifier l'existence ou l'absence
          d'une faille. Le JSON téléchargé décrit votre environnement : partagez-le uniquement
          si vous le souhaitez.
        </p>
      </BrandPanel>
    </div>
  )
}
