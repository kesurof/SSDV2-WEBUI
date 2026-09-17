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
      <div className="rounded-md border">
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
      </div>
    </div>
  )
}
