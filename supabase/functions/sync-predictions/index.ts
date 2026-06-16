import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async () => {
  const apiKey = Deno.env.get('APIFOOTBALL_KEY')!

  const now = new Date()
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000)

  const { data: matches } = await supabase
    .from('matches')
    .select('id, external_match_id')
    .not('external_match_id', 'is', null)
    .is('home_win_pct', null)
    .gte('kickoff_at', now.toISOString())
    .lte('kickoff_at', in48h.toISOString())

  if (!matches || matches.length === 0) {
    return new Response(JSON.stringify({ synced: 0, message: 'No matches to sync' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let synced = 0
  for (const match of matches) {
    const res = await fetch(
      `https://v3.football.api-sports.io/predictions?fixture=${match.external_match_id}`,
      { headers: { 'x-apisports-key': apiKey } }
    )

    const data = await res.json()
    const percent = data.response?.[0]?.predictions?.percent

    if (!percent) continue

    const homeWinPct = parseInt(percent.home ?? '0')
    const drawPct = parseInt(percent.draw ?? '0')
    const awayWinPct = parseInt(percent.away ?? '0')

    await supabase
      .from('matches')
      .update({ home_win_pct: homeWinPct, draw_pct: drawPct, away_win_pct: awayWinPct })
      .eq('id', match.id)

    synced++
  }

  return new Response(JSON.stringify({ synced }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
