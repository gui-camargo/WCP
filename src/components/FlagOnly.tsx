interface FlagOnlyProps {
  flagCode?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
}

export default function FlagOnly({
  flagCode,
  size = 'md',
}: FlagOnlyProps) {
  const sizeMap = {
    xs: 'h-3.5 w-5',
    sm: 'h-4 w-6',
    md: 'h-5 w-7',
    lg: 'h-6 w-9',
    xl: 'h-8 w-12',
  } as const

  const code = (flagCode ?? '').trim().toLowerCase()

  if (!code) {
    return <span className={`${sizeMap[size]} shrink-0 rounded bg-gray-100 border border-gray-200`} />
  }

  return (
    <img
      src={`https://flagcdn.com/40x30/${code}.png`}
      alt={`Bandeira`}
      className={`${sizeMap[size]} shrink-0 rounded object-cover border border-gray-200 shadow-sm`}
      loading="lazy"
    />
  )
}
