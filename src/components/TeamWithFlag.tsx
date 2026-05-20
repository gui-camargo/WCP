interface TeamWithFlagProps {
  name?: string | null
  flagCode?: string | null
  align?: 'left' | 'right' | 'center'
  size?: 'sm' | 'md' | 'lg'
  compact?: boolean
  className?: string
}

export default function TeamWithFlag({
  name,
  flagCode,
  align = 'left',
  size = 'md',
  compact = false,
  className = '',
}: TeamWithFlagProps) {
  const justifyClass = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'
  const code = (flagCode ?? '').trim().toLowerCase()
  const sizeMap = {
    sm: { flag: 'h-4 w-6', text: 'text-xs', gap: 'gap-1.5' },
    md: { flag: 'h-5 w-7', text: 'text-sm', gap: 'gap-2' },
    lg: { flag: 'h-6 w-9', text: 'text-base', gap: 'gap-2.5' },
  } as const
  const current = sizeMap[size]

  return (
    <span
      className={`inline-flex items-center ${justifyClass} ${current.gap} ${compact ? '' : 'px-2 py-1 rounded-lg bg-white/70 border border-gray-100'} ${className}`}
    >
      {code ? (
        <img
          src={`https://flagcdn.com/40x30/${code}.png`}
          alt={`Bandeira ${name ?? ''}`}
          className={`${current.flag} rounded object-cover border border-gray-200 shadow-sm`}
          loading="lazy"
        />
      ) : (
        <span className={`${current.flag} rounded bg-gray-100 border border-gray-200`} />
      )}
      <span className={`truncate ${current.text}`}>{name ?? '-'}</span>
    </span>
  )
}
