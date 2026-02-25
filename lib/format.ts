export function formatCount(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}

export function formatCO2(tonnes: number): string {
  if (tonnes >= 1_000_000) return `${(tonnes / 1_000_000).toFixed(1)}M t`
  if (tonnes >= 1_000) return `${(tonnes / 1_000).toFixed(1)}K t`
  return `${tonnes.toFixed(0)} t`
}

export function formatEUR(eur: number): string {
  if (eur >= 1_000_000_000) return `€${(eur / 1_000_000_000).toFixed(2)}B`
  if (eur >= 1_000_000) return `€${(eur / 1_000_000).toFixed(1)}M`
  if (eur >= 1_000) return `€${(eur / 1_000).toFixed(0)}K`
  return `€${eur.toFixed(0)}`
}
