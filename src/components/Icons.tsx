// ============================================================
// Kit de Ícones · Bolão 'Bruno Ba-Bet' Copa 2026
// Todos em currentColor, stroke 1.5, viewBox 24×24
// ============================================================

interface IconProps {
  className?: string
}

// 1. Próximas Partidas
export function IconUpcomingMatches({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
      <path d="M3 9h18" />
      <path d="M8 2.5v4M16 2.5v4" />
      <circle cx="15" cy="15" r="3.4" />
      <path d="M15 13.4V15l1.1.9" />
    </svg>
  )
}

// 2. Partidas Encerradas
export function IconFinishedMatches({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.2l2.6 2.6L16 9.4" />
    </svg>
  )
}

// 3. Meus Palpites
export function IconMyPredictions({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.6" />
      <circle cx="12" cy="12" r="1" />
      <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2" />
    </svg>
  )
}

// 4. Ranking
export function IconRanking({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M10 14.5h4v6h-4z" />
      <path d="M4 17.5h4v3H4zM16 11.5h4v9h-4z" />
      <path d="M12 3.2l1.5 3 3.3.4-2.4 2.3.6 3.3L12 11.6 9.4 12.2l.6-3.3L7.6 6.6l3.3-.4z" />
    </svg>
  )
}

// 5. Premiação
export function IconAward({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M7 4h10v3a5 5 0 0 1-10 0z" />
      <path d="M7 5H4.5v1.5A3.5 3.5 0 0 0 7 9.8M17 5h2.5v1.5A3.5 3.5 0 0 1 17 9.8" />
      <path d="M12 12v3" />
      <path d="M9.5 20h5l-.6-2.5a1 1 0 0 0-1-.75h-1.8a1 1 0 0 0-1 .75z" />
    </svg>
  )
}

// 6. Participantes
export function IconParticipants({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.2a3.2 3.2 0 0 1 0 5.6" />
      <path d="M17.5 13.6A5.5 5.5 0 0 1 20.5 18.5" />
    </svg>
  )
}

// 7. Fase de Grupos
export function IconGroupPhase({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  )
}

// 8. Fase Eliminatória
export function IconEliminationPhase({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 5.5h3.5a2 2 0 0 1 2 2v9a2 2 0 0 0 2 2H14" />
      <path d="M4 18.5h3.5a2 2 0 0 0 2-2" />
      <circle cx="16" cy="5.5" r="2" />
      <circle cx="16" cy="18.5" r="2" />
      <circle cx="20" cy="12" r="2" />
      <path d="M14 12h4" />
    </svg>
  )
}

// 9. Colocados Finais
export function IconFinalStandings({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M8 4h8v4a4 4 0 0 1-8 0z" />
      <path d="M8 5H5.5v1A3 3 0 0 0 8 9M16 5h2.5v1A3 3 0 0 1 16 9" />
      <path d="M12 12v2.5" />
      <path d="M8.5 20h7v-1.5a1.5 1.5 0 0 0-1.5-1.5h-4a1.5 1.5 0 0 0-1.5 1.5z" />
      <path d="M11.2 6.2 12 5l.8 1.2" />
    </svg>
  )
}

// 10. Document
export function IconDocument({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </svg>
  )
}

// 11. Settings
export function IconSettings({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m4.24-4.24l4.24-4.24" />
    </svg>
  )
}

// Export all icons as a map for easy iteration
export const ICONS = {
  upcomingMatches: IconUpcomingMatches,
  finishedMatches: IconFinishedMatches,
  myPredictions: IconMyPredictions,
  ranking: IconRanking,
  award: IconAward,
  participants: IconParticipants,
  groupPhase: IconGroupPhase,
  eliminationPhase: IconEliminationPhase,
  finalStandings: IconFinalStandings,
  document: IconDocument,
  settings: IconSettings,
}
