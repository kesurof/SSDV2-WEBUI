import { useQueryClient } from '@tanstack/react-query'

import { UpdatesView } from '@/features/updates/UpdatesView'
import { useUpdates } from '@/features/system/useSystem'

export function UpdatesPage() {
  const updates = useUpdates()
  const queryClient = useQueryClient()

  return (
    <UpdatesView
      updates={updates.data}
      onRefresh={() => queryClient.invalidateQueries({ queryKey: ['updates'] })}
    />
  )
}
