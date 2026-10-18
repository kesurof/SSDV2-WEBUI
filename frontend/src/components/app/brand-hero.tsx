import type { ReactNode } from 'react'

/** Dashboard hero using an untouched illustration exported by projetssd/branding. */
export function BrandHero({
  title,
  subtitle,
  status,
}: {
  title: string
  subtitle: string
  status?: ReactNode
}) {
  return (
    <section className="ssdv2-hero relative isolate min-w-0 overflow-hidden rounded-2xl border" aria-label={title}>
      <div className="relative z-10 max-w-xl space-y-3 p-5 sm:p-7">
        <div className="ssdv2-eyebrow"><span className="ssdv2-triad" aria-hidden /> SSDv2 / CONTROL</div>
        <h1 className="max-w-md text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
        {status ? <div className="pt-1">{status}</div> : null}
      </div>
      <img
        src="/branding/illustrations/administration.svg"
        alt=""
        aria-hidden="true"
        className="ssdv2-hero-art pointer-events-none absolute top-1/2 right-[-4rem] hidden w-[18rem] -translate-y-1/2 opacity-80 sm:block lg:right-[-1rem] lg:w-[21rem]"
      />
    </section>
  )
}
