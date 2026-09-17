import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AuthAppsView } from '@/features/auth/AuthAppsView'
import type { AuthType } from '@/features/auth/authTypes'
import { useAppAuthList, useBulkAuth } from '@/features/settings/useSettings'
import { useApps } from '@/features/system/useSystem'
import { fr } from '@/i18n/fr'

export function AuthAppsPage() {
  const apps = useApps()
  const authList = useAppAuthList()
  const bulkAuth = useBulkAuth()
  const navigate = useNavigate()
  const [selected, setSelected] = useState<string[]>([])
  const [auth, setAuth] = useState<AuthType>('aucune')

  if (apps.isPending || authList.isPending) {
    return <p className="text-sm text-muted-foreground">{fr.common.loading}</p>
  }

  if (apps.isError || authList.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{fr.common.error}</AlertTitle>
        <AlertDescription>{fr.common.error}</AlertDescription>
      </Alert>
    )
  }

  const installed = apps.data.filter((app) => app.installed)
  const authByApp: Record<string, string | null> = Object.fromEntries(
    authList.data.map((item) => [item.app, item.auth]),
  )

  function toggle(app: string) {
    setSelected((current) =>
      current.includes(app) ? current.filter((item) => item !== app) : [...current, app],
    )
  }

  function toggleAll() {
    setSelected((current) => (current.length === installed.length ? [] : installed.map((a) => a.name)))
  }

  function apply() {
    bulkAuth.mutate(
      { apps: selected, auth },
      {
        onSuccess: (job) => {
          setSelected([])
          toast.success(fr.jobs.launched.replace('{id}', String(job.id)))
          navigate(`/jobs/${job.id}`)
        },
        onError: (error) => {
          toast.error(error.message)
        },
      },
    )
  }

  return (
    <AuthAppsView
      apps={installed}
      authByApp={authByApp}
      selected={selected}
      auth={auth}
      busy={bulkAuth.isPending}
      onToggle={toggle}
      onToggleAll={toggleAll}
      onAuthChange={setAuth}
      onApply={apply}
    />
  )
}
