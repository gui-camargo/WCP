import { Link } from 'react-router-dom'

interface BackButtonProps {
  to: string
  label?: string
}

export default function BackButton({ to, label = 'Voltar' }: BackButtonProps) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 py-2 pr-3 text-xs font-semibold text-gray-500 hover:text-gray-800 transition"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-3.5 w-3.5"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>
      {label}
    </Link>
  )
}
