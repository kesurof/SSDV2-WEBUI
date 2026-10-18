import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BrandLogo, BrandMark } from '@/components/app/brand-logo'

describe('official SSDv2 branding', () => {
  it('references the official variants for light and dark themes', () => {
    render(<BrandLogo />)
    const logos = screen.getAllByRole('img', { name: 'SSDv2' })
    expect(logos).toHaveLength(2)
    expect(logos[0]).toHaveAttribute('src', '/branding/ssdv2-horizontal-light.svg')
    expect(logos[1]).toHaveAttribute('src', '/branding/ssdv2-horizontal-dark.svg')
  })

  it('provides a standalone mark for the compact navigation', () => {
    render(<BrandMark />)
    expect(screen.getByRole('img', { name: 'SSDv2' })).toHaveAttribute('src', '/branding/ssdv2-icon.svg')
  })
})
