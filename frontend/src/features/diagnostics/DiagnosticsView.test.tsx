import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DiagnosticsView } from '@/features/diagnostics/DiagnosticsPage'

describe('DiagnosticsView', () => {
  it('renders checks', () => {
    render(
      <DiagnosticsView
        checks={{
          missing_registries: ['appname', 'boostsuitev2'],
          orphan_containers: [],
          dangling_volumes: 2,
        }}
        warnings={[]}
      />,
    )

    expect(screen.getByText('appname')).toBeInTheDocument()
    expect(screen.getByText('boostsuitev2')).toBeInTheDocument()
    expect(screen.getByText('Aucun')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('renders warnings', () => {
    render(
      <DiagnosticsView
        checks={{ missing_registries: [], orphan_containers: [], dangling_volumes: 0 }}
        warnings={['ssddb_unavailable']}
      />,
    )

    expect(screen.getByText('Base ssddb illisible')).toBeInTheDocument()
  })
})
