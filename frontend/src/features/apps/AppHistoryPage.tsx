import { useState } from 'react'
import { useParams } from 'react-router-dom'

import { AppHistoryView } from '@/features/apps/AppHistoryView'
import type { HistoryFilter } from '@/features/apps/AppHistoryView'
import { useAppHistory } from '@/features/system/useSystem'

const KIND_MAP: Record<HistoryFilter, string | null> = {
  all: null,
  job: 'job',
  audit: 'audit',
  notification: 'notification',
  backup: 'backup',
  errors: 'errors',
}

export function AppHistoryPage() {
  const params = useParams()
  const app = params.app ?? ''
  const [filter, setFilter] = useState<HistoryFilter>('all')
  const history = useAppHistory(app, KIND_MAP[filter])

  return (
    <AppHistoryView
      app={app}
      events={history.data?.events}
      filter={filter}
      onFilterChange={setFilter}
    />
  )
}
