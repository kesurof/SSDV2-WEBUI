import { describe, expect, it } from 'vitest'
import { mobilePageTitle } from '@/app/mobile-page-title'

describe('mobilePageTitle', () => {
  it('labels sections and detail screens', () => {
    expect(mobilePageTitle('/updates')).toBe('Mises à jour')
    expect(mobilePageTitle('/apps')).toBe('Applications')
    expect(mobilePageTitle('/apps/sonarr')).toBe('sonarr')
    expect(mobilePageTitle('/apps/sonarr/history')).toBe('Historique')
    expect(mobilePageTitle('/jobs/42')).toBe('Job #42')
    expect(mobilePageTitle('/unknown')).toBe('SSDv2')
  })
})
