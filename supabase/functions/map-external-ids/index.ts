import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// API stadium_id → DB venue value
const STADIUM_TO_VENUE: Record<string, string> = {
  '1':  'Cidade do Mexico, Mexico',
  '2':  'Guadalajara, Mexico',
  '3':  'Monterrey, Mexico',
  '4':  'Dallas, EUA',
  '5':  'Houston, EUA',
  '6':  'Kansas City, EUA',
  '7':  'Atlanta, EUA',
  '8':  'Miami, EUA',
  '9':  'Boston, EUA',
  '10': 'Filadelfia, EUA',
  '11': 'Nova York/Nova Jersey, EUA',
  '12': 'Toronto, Canada',
  '13': 'Vancouver, Canada',
  '14': 'Seattle, EUA',
  '15': 'Santa Clara, EUA',
  '16': 'Los Angeles, EUA',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Fetch API games
    const res = await fetch('http://worldcup26.ir:3050/get/games')
    const raw = await res.json()
    const apiGames: any[] = Array.isArray(raw) ? raw : (raw.games ?? raw.data ?? [])

    if (apiGames.length === 0) {
      return new Response(
        JSON.stringify({ mapped: 0, total: 0, message: 'No games returned from API' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Expose first game fields for debugging
    const sampleGameKeys = Object.keys(apiGames[0] ?? {})
    const hasStadiumId = apiGames.some((g: any) => g.stadium_id != null)

    // Fetch all groups
    const { data: groups, error: groupsError } = await supabase
      .from('groups')
      .select('id, code')

    if (groupsError) {
      return new Response(
        JSON.stringify({ mapped: 0, total: 0, message: 'Groups query error', error: groupsError }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const groupCodeMap = new Map((groups ?? []).map((g: any) => [g.id, g.code as string]))

    // Fetch unmatched matches
    const { data: dbMatches, error: matchesError } = await supabase
      .from('matches')
      .select('id, kickoff_at, group_id, venue')
      .is('external_match_id', null)

    if (matchesError) {
      return new Response(
        JSON.stringify({ mapped: 0, total: 0, message: 'Matches query error', error: matchesError }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!dbMatches || dbMatches.length === 0) {
      return new Response(
        JSON.stringify({ mapped: 0, total: 0, message: 'No unmatched DB matches', sampleGameKeys }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let mapped = 0
    const results: { match_id: string; external_id: string; group: string; venue: string }[] = []
    const unmatched: { match_id: string; group: string | null; venue: string; kickoff: string }[] = []

    for (const match of dbMatches) {
      const groupCode = match.group_id ? groupCodeMap.get(match.group_id) : null
      const dbVenue = match.venue
      const kickoffDate = new Date(match.kickoff_at)

      let apiGame: any = null

      if (groupCode && dbVenue && hasStadiumId) {
        // Primary strategy: group code + stadium + date
        // Tolerance 1.5 days handles UTC vs local time offset for late-night games
        // Same group+stadium games are always 5+ days apart so no false positives
        apiGame = apiGames.find((g: any) => {
          const groupOk = (g.group ?? '').toUpperCase() === groupCode.toUpperCase()
          const venueOk = STADIUM_TO_VENUE[String(g.stadium_id)] === dbVenue
          if (!groupOk || !venueOk) return false
          const parts = (g.local_date ?? '').split(' ')[0].split('/')
          if (parts.length < 3) return false
          const [month, day, year] = parts
          const apiDate = new Date(`${year}-${month}-${day}`)
          const diffDays = Math.abs(kickoffDate.getTime() - apiDate.getTime()) / (1000 * 60 * 60 * 24)
          return diffDays <= 1.5
        })
      }

      if (!apiGame && groupCode) {
        // Fallback: group code + date (within 1.5 days to handle UTC vs local offset)
        const candidates = apiGames.filter((g: any) => {
          const groupOk = (g.group ?? '').toUpperCase() === groupCode.toUpperCase()
          if (!groupOk) return false
          const parts = (g.local_date ?? '').split(' ')[0].split('/')
          if (parts.length < 3) return false
          const [month, day, year] = parts
          const apiDate = new Date(`${year}-${month}-${day}`)
          const diffDays = Math.abs(kickoffDate.getTime() - apiDate.getTime()) / (1000 * 60 * 60 * 24)
          return diffDays <= 1.5
        })
        if (candidates.length === 1) apiGame = candidates[0]
      }

      if (!apiGame && !groupCode && dbVenue && hasStadiumId) {
        // Knockout: no group, use venue + date
        const candidates = apiGames.filter((g: any) => {
          const venueOk = STADIUM_TO_VENUE[String(g.stadium_id)] === dbVenue
          if (!venueOk) return false
          const parts = (g.local_date ?? '').split(' ')[0].split('/')
          if (parts.length < 3) return false
          const [month, day, year] = parts
          const apiDate = new Date(`${year}-${month}-${day}`)
          const diffDays = Math.abs(kickoffDate.getTime() - apiDate.getTime()) / (1000 * 60 * 60 * 24)
          return diffDays <= 1.5
        })
        if (candidates.length === 1) apiGame = candidates[0]
      }

      if (!apiGame) {
        unmatched.push({ match_id: match.id, group: groupCode ?? null, venue: dbVenue, kickoff: match.kickoff_at })
        continue
      }

      await supabase
        .from('matches')
        .update({ external_match_id: parseInt(apiGame.id) })
        .eq('id', match.id)

      results.push({
        match_id: match.id,
        external_id: apiGame.id,
        group: apiGame.group ?? 'knockout',
        venue: dbVenue,
      })
      mapped++
    }

    return new Response(
      JSON.stringify({ mapped, total: dbMatches.length, results, unmatched, sampleGameKeys, hasStadiumId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    return new Response(
      JSON.stringify({ mapped: 0, total: 0, message: 'Unexpected error', error: err?.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
