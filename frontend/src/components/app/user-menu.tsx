import { ChevronDown, LogOut } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { fr } from '@/i18n/fr'

export function UserMenu({
  username,
  internalAuth,
  externalLogoutUrl,
  onLogout,
}: {
  username: string
  internalAuth: boolean
  externalLogoutUrl?: string | null
  onLogout: () => void
}) {
  const avatar = (
    <span className="grid size-8 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
      {username.slice(0, 1).toUpperCase()}
    </span>
  )
  const identity = (
    <span className="hidden text-left sm:block">
      <span className="block text-sm font-medium">{username}</span>
      <span className="block text-[11px] text-muted-foreground">
        {internalAuth ? 'Administrateur' : fr.security.external}
      </span>
    </span>
  )

  if (!internalAuth) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg px-2 py-1" title={username}>
          {avatar}
          {identity}
        </div>
        {externalLogoutUrl ? (
          <Button variant="outline" size="sm" render={<a href={externalLogoutUrl} />}>
            <LogOut className="size-4" aria-hidden />
            {fr.security.externalLogout}
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" className="gap-2 px-2" />}>
        {avatar}
        {identity}
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{username}</DropdownMenuLabel>
          <DropdownMenuItem onClick={onLogout}>
            <LogOut className="size-4" aria-hidden />
            {fr.common.logout}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
