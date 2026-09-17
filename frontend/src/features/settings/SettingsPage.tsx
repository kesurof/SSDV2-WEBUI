import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { SecuritySettings } from '@/features/settings/SecuritySettings'
import { SettingsView } from '@/features/settings/SettingsView'
import { useConfig } from '@/features/settings/useSettings'
import { fr } from '@/i18n/fr'

export function SettingsPage() {
  const config = useConfig()

  if (config.isPending) {
    return <p className="text-sm text-muted-foreground">{fr.common.loading}</p>
  }

  if (config.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{fr.common.error}</AlertTitle>
        <AlertDescription>{config.error.message}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <SettingsView config={config.data.config} />
      <SecuritySettings />
    </div>
  )
}
