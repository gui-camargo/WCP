import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async () => {
  const res = await fetch('http://worldcup26.ir:3050/get/games')
  const raw = await res.json()
  const apiGames: any[] = Array.isArray(raw) ? raw : (raw.games ?? raw.data ?? [])

  // Only process games that are live or finished (skip notstarted)
  const activeGames = apiGames.filter(
    (g: any) => g.time_elapsed !== 'notstarted'
  )

  if (activeGames.length === 0) {
    return new Response(JSON.stringify({ updated: 0, message: 'No active games' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const externalIds = activeGames.map((g: any) => parseInt(g.id))

  const { data: matches } = await supabase
    .from('matches')
    .select('id, external_match_id, status')
    .in('external_match_id', externalIds)

  if (!matches || matches.length === 0) {
    return new Response(JSON.stringify({ updated: 0, message: 'No matching DB matches' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const matchMap = new Map(matches.map((m: any) => [m.external_match_id, m]))

  let updated = 0
  for (const game of activeGames) {
    const dbMatch = matchMap.get(parseInt(game.id))
    if (!dbMatch) continue

    // Skip already closed matches
    if (dbMatch.status === 'encerrado') continue

    const newStatus =
      game.finished === 'TRUE' ? 'encerrado'
      : game.time_elapsed === 'notstarted' ? 'pendente'
      : 'ao_vivo'

    const homeScore = parseInt(game.home_score ?? '0')
    const awayScore = parseInt(game.away_score ?? '0')

    await supabase
      .from('matches')
      .update({ home_score: homeScore, away_score: awayScore, status: newStatus })
      .eq('id', dbMatch.id)

    updated++
  }

  return new Response(JSON.stringify({ updated }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
