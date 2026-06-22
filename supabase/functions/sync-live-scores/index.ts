import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const ESPN_VENUE_TO_DB: Record<string, string> = {
  'Estadio Azteca':                  'Cidade do Mexico, Mexico',
  'Estadio Akron':                   'Guadalajara, Mexico',
  'Estadio BBVA':                    'Monterrey, Mexico',
  'AT&T Stadium':                    'Dallas, EUA',
  'NRG Stadium':                     'Houston, EUA',
  'GEHA Field at Arrowhead Stadium': 'Kansas City, EUA',
  'Mercedes-Benz Stadium':           'Atlanta, EUA',
  'Hard Rock Stadium':               'Miami, EUA',
  'Gillette Stadium':                'Boston, EUA',
  'Lincoln Financial Field':         'Filadelfia, EUA',
  'MetLife Stadium':                 'Nova York/Nova Jersey, EUA',
  'BMO Field':                       'Toronto, Canada',
  'BC Place':                        'Vancouver, Canada',
  'Lumen Field':                     'Seattle, EUA',
  "Levi's Stadium":                  'Santa Clara, EUA',
  'SoFi Stadium':                    'Los Angeles, EUA',
}

function moneylineToImplied(odds: string): number {
  const n = parseFloat(odds)
  return n < 0 ? Math.abs(n) / (Math.abs(n) + 100) : 100 / (n + 100)
}

function findDbMatch(
  matches: any[],
  eventDate: Date,
  venueName: string,
  skipped: { event_id: string; reason: string }[],
  eventId: string,
): any | null {
  const candidates = matches.filter((m: any) => {
    const diff = Math.abs(new Date(m.kickoff_at).getTime() - eventDate.getTime())
    return diff <= 5 * 60 * 1000
  })

  if (candidates.length === 1) return candidates[0]

  if (candidates.length > 1) {
    const dbVenue = ESPN_VENUE_TO_DB[venueName]
    const match = candidates.find((m: any) => m.venue === dbVenue) ?? null
    if (!match) skipped.push({ event_id: eventId, reason: `${candidates.length} candidates, venue "${venueName}" unresolved` })
    return match
  }

  skipped.push({ event_id: eventId, reason: 'no DB match for kickoff time' })
  return null
}

function espnDate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '')
}

Deno.serve(async () => {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  const tomorrow = new Date(today)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)

  const base = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates='
  const [r1, r2, r3] = await Promise.all([
    fetch(`${base}${espnDate(yesterday)}`),
    fetch(`${base}${espnDate(today)}`),
    fetch(`${base}${espnDate(tomorrow)}`),
  ])
  const [d1, d2, d3] = await Promise.all([r1.json(), r2.json(), r3.json()])

  // Deduplica por event.id caso o mesmo jogo apareça em múltiplos dias
  const eventMap = new Map<string, any>()
  for (const e of [...(d1.events ?? []), ...(d2.events ?? []), ...(d3.events ?? [])]) {
    eventMap.set(e.id, e)
  }
  const events: any[] = [...eventMap.values()]

  const activeEvents = events.filter((e: any) => {
    const state = e.status?.type?.state
    return state === 'in' || state === 'post'
  })

  const preEvents = events.filter((e: any) => e.status?.type?.state === 'pre')

  if (activeEvents.length === 0 && preEvents.length === 0) {
    return new Response(JSON.stringify({ updated: 0, message: 'No active or upcoming games' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { data: matches, error: matchesError } = await supabase
    .from('matches')
    .select('id, kickoff_at, venue, status')
    .neq('status', 'encerrado')

  if (matchesError) {
    return new Response(JSON.stringify({ updated: 0, error: matchesError }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!matches || matches.length === 0) {
    return new Response(JSON.stringify({ updated: 0, message: 'No open matches in DB' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let updated = 0
  let oddsUpdated = 0
  const errors: { event_id: string; error: any }[] = []
  const skipped: { event_id: string; reason: string }[] = []

  // Live score sync
  for (const event of activeEvents) {
    const eventDate = new Date(event.date)
    const competition = event.competitions?.[0]
    const venueName: string = competition?.venue?.fullName ?? ''

    const dbMatch = findDbMatch(matches, eventDate, venueName, skipped, event.id)
    if (!dbMatch) continue

    const homeComp = competition?.competitors?.find((c: any) => c.homeAway === 'home')
    const awayComp = competition?.competitors?.find((c: any) => c.homeAway === 'away')
    const homeScore = parseInt(homeComp?.score ?? '0')
    const awayScore = parseInt(awayComp?.score ?? '0')
    const isFinished = competition?.status?.type?.completed === true
    const newStatus = isFinished ? 'encerrado' : 'ao_vivo'
    const timeDetail: string | null = isFinished ? null : (competition?.status?.type?.shortDetail ?? null)

    const { error } = await supabase
      .from('matches')
      .update({ home_score: homeScore, away_score: awayScore, status: newStatus, time_detail: timeDetail })
      .eq('id', dbMatch.id)

    if (error) errors.push({ event_id: event.id, error })
    else updated++
  }

  // Pre-match odds sync
  for (const event of preEvents) {
    const competition = event.competitions?.[0]
    const oddsData = competition?.odds?.[0]
    if (!oddsData?.moneyline) continue

    const homeOddsStr = oddsData.moneyline?.home?.close?.odds ?? oddsData.moneyline?.home?.open?.odds
    const awayOddsStr = oddsData.moneyline?.away?.close?.odds ?? oddsData.moneyline?.away?.open?.odds
    const drawOddsStr = oddsData.moneyline?.draw?.close?.odds ?? oddsData.moneyline?.draw?.open?.odds
    if (!homeOddsStr || !awayOddsStr || !drawOddsStr) continue

    const homeImplied = moneylineToImplied(homeOddsStr)
    const awayImplied = moneylineToImplied(awayOddsStr)
    const drawImplied = moneylineToImplied(drawOddsStr)
    const total = homeImplied + awayImplied + drawImplied

    const homeWinPct = Math.round((homeImplied / total) * 100)
    const awayWinPct = Math.round((awayImplied / total) * 100)
    const drawPct = 100 - homeWinPct - awayWinPct

    const eventDate = new Date(event.date)
    const venueName: string = competition?.venue?.fullName ?? ''

    const dbMatch = findDbMatch(matches, eventDate, venueName, skipped, event.id)
    if (!dbMatch) continue

    const { error } = await supabase
      .from('matches')
      .update({ home_win_pct: homeWinPct, draw_pct: drawPct, away_win_pct: awayWinPct })
      .eq('id', dbMatch.id)

    if (error) errors.push({ event_id: event.id, error })
    else oddsUpdated++
  }

  return new Response(JSON.stringify({ updated, oddsUpdated, errors, skipped }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
