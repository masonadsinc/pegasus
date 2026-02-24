'use client'

import { ClientTabs } from '@/app/clients/[slug]/client-tabs'

export function PortalTabs(props: any) {
  return <ClientTabs {...props} portalMode={true} />
}
