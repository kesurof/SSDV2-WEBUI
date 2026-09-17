import { useQueryClient } from '@tanstack/react-query'

import { HealthView } from '@/features/health/HealthView'
import { useMetrics, useSystemHealth, useUpdates } from '@/features/system/useSystem'

export function HealthPage() {
  const health = useSystemHealth()
  const metrics = useMetrics()
  const updates = useUpdates()
  const queryClient = useQueryClient()

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['system', 'health'] })
    queryClient.invalidateQueries({ queryKey: ['system', 'metrics'] })
    queryClient.invalidateQueries({ queryKey: ['updates'] })
  }

  return (
    <HealthView
      health={health.data}
      metrics={metrics.data}
      updatesCount={updates.data?.available}
      onRefresh={refresh}
    />
  )
}
