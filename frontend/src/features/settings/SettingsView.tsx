import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PageHeader } from '@/components/app/page-header'
import { BrandPanel, BrandSectionHeading } from '@/components/app/brand-panel'
import { EmptyState } from '@/components/app/empty-state'
import { Settings2 } from 'lucide-react'
import { MobileCards, MobileCard } from '@/components/app/mobile-cards'
import { fr } from '@/i18n/fr'

const KEY_LABELS: Record<string, string> = {
  'settings.source': fr.settings.source,
  'settings.storage': fr.settings.storage,
  'user.domain': fr.settings.domain,
  'user.mail': fr.settings.mail,
  'user.name': fr.settings.user,
  oauth_enabled: fr.settings.oauthEnabled,
  oauth_type: fr.settings.oauthType,
  'rclone.remote': fr.settings.rcloneRemote,
}

export function SettingsView({ config }: { config: Record<string, string | null> }) {
  return (
    <div className="space-y-4">
      <PageHeader title={fr.settings.title} subtitle={fr.settings.hint} />
      <Alert>
        <AlertTitle>{fr.settings.readOnly}</AlertTitle>
        <AlertDescription>{fr.settings.hint}</AlertDescription>
      </Alert>
      <BrandSectionHeading>Configuration de l'instance</BrandSectionHeading>
      {Object.keys(config).length === 0 && <EmptyState icon={Settings2} message="Aucune configuration disponible." illustrated />}
      <MobileCards label="Paramètres (vue mobile)">
        {Object.entries(config).map(([key, value]) => (
          <MobileCard key={key}>
            <div className="text-xs font-semibold text-muted-foreground">{KEY_LABELS[key] ?? key}</div>
            <div className="mt-2 min-w-0 break-all font-mono text-xs">{value ?? '—'}</div>
          </MobileCard>
        ))}
      </MobileCards>
      <BrandPanel as="div" className="hidden lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{fr.settings.key}</TableHead>
              <TableHead>{fr.settings.value}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(config).map(([key, value]) => (
              <TableRow key={key}>
                <TableCell className="font-mono text-xs">
                  {KEY_LABELS[key] ?? key}
                </TableCell>
                <TableCell className="font-mono text-xs">{value ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </BrandPanel>
    </div>
  )
}
