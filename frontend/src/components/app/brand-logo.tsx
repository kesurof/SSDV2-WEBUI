import { cn } from '@/lib/utils'

/** Identité SSDv2 officielle. Les SVG sont issus de projetssd/branding. */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center', className)}>
      <img
        src="/branding/ssdv2-horizontal-light.svg"
        className="block h-auto w-full dark:hidden"
        alt="SSDv2"
      />
      <img
        src="/branding/ssdv2-horizontal-dark.svg"
        className="hidden h-auto w-full dark:block"
        alt="SSDv2"
      />
    </span>
  )
}

export function BrandMark({ className }: { className?: string }) {
  return <img src="/branding/ssdv2-icon.svg" alt="SSDv2" className={cn('size-9 object-contain', className)} />
}
