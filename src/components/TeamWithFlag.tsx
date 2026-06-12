interface TeamWithFlagProps {
  name?: string | null
  flagCode?: string | null
  align?: 'left' | 'right' | 'center'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  compact?: boolean
  stacked?: boolean
  reverse?: boolean
  className?: string
}

export default function TeamWithFlag({
  name,
  flagCode,
  align = 'left',
  size = 'md',
  compact = false,
  stacked = false,
  reverse = false,
  className = '',
}: TeamWithFlagProps) {
  const alignItemsClass = align === 'right' ? 'items-end text-right' : align === 'center' ? 'items-center text-center' : 'items-start text-left'
  const code = (flagCode ?? '').trim().toLowerCase()
  const sizeMap = {
    xs: { flag: 'h-3.5 w-5', text: 'text-[10px]', gap: 'gap-1' },
    sm: { flag: 'h-4 w-6', text: 'text-xs', gap: 'gap-1.5' },
    md: { flag: 'h-5 w-7', text: 'text-sm', gap: 'gap-2' },
    lg: { flag: 'h-6 w-9', text: 'text-base', gap: 'gap-2.5' },
    xl: { flag: 'h-8 w-12', text: 'text-sm', gap: 'gap-2.5' },
  } as const
  const current = sizeMap[size]

  const flagEl = code ? (
    <img
      src={`https://flagcdn.com/40x30/${code}.png`}
      alt={`Bandeira ${name ?? ''}`}
      className={`${current.flag} shrink-0 rounded object-cover border border-gray-200 shadow-sm`}
      loading="lazy"
    />
  ) : (
    <span className={`${current.flag} shrink-0 rounded bg-gray-100 border border-gray-200`} />
  )

  const textAlignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'

  const nameEl = (
    <span className={`${stacked ? `mt-1 max-w-[80px] whitespace-normal break-words leading-tight text-center ${current.text}` : `min-w-0 whitespace-normal break-words leading-tight ${textAlignClass} ${current.text}`}`}>
      {name ?? '-'}
    </span>
  )

  return (
    <span
      className={`${stacked ? `flex flex-col ${alignItemsClass}` : `inline-flex items-center ${current.gap}`} ${compact ? '' : 'px-2 py-1 rounded-lg bg-white/70 border border-gray-100'} ${className}`}
    >
      {reverse ? <>{nameEl}{flagEl}</> : <>{flagEl}{nameEl}</>}
    </span>
  )
}
