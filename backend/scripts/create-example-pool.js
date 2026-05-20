#!/usr/bin/env node

/**
 * Script para gerar dados de exemplo para o bolão
 * Uso: node backend/scripts/create-example-pool.js <SUPABASE_URL> <SUPABASE_KEY>
 */

const { createClient } = require('@supabase/supabase-js');

// Times por grupo (Copa 2026)
const groupsTeams = {
  A: ['México', 'África do Sul', 'Coreia do Sul', 'República Tcheca'],
  B: ['Canadá', 'Bósnia e Herzegovina', 'Catar', 'Suíça'],
  C: ['Brasil', 'Marrocos', 'Haiti', 'Escócia'],
  D: ['Estados Unidos', 'Paraguai', 'Austrália', 'Turquia'],
  E: ['Alemanha', 'Curaçao', 'Costa do Marfim', 'Equador'],
  F: ['Holanda', 'Japão', 'Suécia', 'Tunísia'],
  G: ['Bélgica', 'Egito', 'Irã', 'Nova Zelândia'],
  H: ['Espanha', 'Cabo Verde', 'Arábia Saudita', 'Uruguai'],
  I: ['França', 'Senegal', 'Iraque', 'Noruega'],
  J: ['Argentina', 'Argélia', 'Áustria', 'Jordânia'],
  K: ['Colômbia', 'Uzbequistão', 'Portugal', 'RD Congo'],
  L: ['Inglaterra', 'Croácia', 'Gana', 'Panamá'],
};

// Jogos por grupo (rodadas 1, 2, 3)
const matchesByGroup = {
  A: [
    [['México', 'África do Sul'], ['Coreia do Sul', 'República Tcheca']],
    [['República Tcheca', 'África do Sul'], ['México', 'Coreia do Sul']],
    [['República Tcheca', 'México'], ['África do Sul', 'Coreia do Sul']],
  ],
  B: [
    [['Canadá', 'Bósnia e Herzegovina'], ['Catar', 'Suíça']],
    [['Suíça', 'Bósnia e Herzegovina'], ['Canadá', 'Catar']],
    [['Suíça', 'Canadá'], ['Bósnia e Herzegovina', 'Catar']],
  ],
  C: [
    [['Brasil', 'Marrocos'], ['Haiti', 'Escócia']],
    [['Escócia', 'Marrocos'], ['Brasil', 'Haiti']],
    [['Escócia', 'Brasil'], ['Marrocos', 'Haiti']],
  ],
  D: [
    [['Estados Unidos', 'Paraguai'], ['Austrália', 'Turquia']],
    [['Austrália', 'Paraguai'], ['Estados Unidos', 'Turquia']],
    [['Estados Unidos', 'Austrália'], ['Paraguai', 'Turquia']],
  ],
  E: [
    [['Alemanha', 'Curaçao'], ['Costa do Marfim', 'Equador']],
    [['Alemanha', 'Equador'], ['Costa do Marfim', 'Curaçao']],
    [['Alemanha', 'Costa do Marfim'], ['Equador', 'Curaçao']],
  ],
  F: [
    [['Holanda', 'Japão'], ['Suécia', 'Tunísia']],
    [['Japão', 'Tunísia'], ['Holanda', 'Suécia']],
    [['Holanda', 'Tunísia'], ['Japão', 'Suécia']],
  ],
  G: [
    [['Bélgica', 'Egito'], ['Irã', 'Nova Zelândia']],
    [['Bélgica', 'Nova Zelândia'], ['Egito', 'Irã']],
    [['Bélgica', 'Irã'], ['Egito', 'Nova Zelândia']],
  ],
  H: [
    [['Espanha', 'Cabo Verde'], ['Arábia Saudita', 'Uruguai']],
    [['Espanha', 'Uruguai'], ['Cabo Verde', 'Arábia Saudita']],
    [['Espanha', 'Arábia Saudita'], ['Cabo Verde', 'Uruguai']],
  ],
  I: [
    [['França', 'Senegal'], ['Iraque', 'Noruega']],
    [['França', 'Noruega'], ['Senegal', 'Iraque']],
    [['França', 'Iraque'], ['Senegal', 'Noruega']],
  ],
  J: [
    [['Argentina', 'Argélia'], ['Áustria', 'Jordânia']],
    [['Argentina', 'Jordânia'], ['Argélia', 'Áustria']],
    [['Argentina', 'Áustria'], ['Argélia', 'Jordânia']],
  ],
  K: [
    [['Colômbia', 'Uzbequistão'], ['Portugal', 'RD Congo']],
    [['Colômbia', 'RD Congo'], ['Portugal', 'Uzbequistão']],
    [['Colômbia', 'Portugal'], ['Uzbequistão', 'RD Congo']],
  ],
  L: [
    [['Inglaterra', 'Croácia'], ['Gana', 'Panamá']],
    [['Inglaterra', 'Panamá'], ['Croácia', 'Gana']],
    [['Inglaterra', 'Gana'], ['Croácia', 'Panamá']],
  ],
};

async function createExamplePool() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('❌ VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY obrigatórios');
    process.exit(1);
  }

  const supabase = createClient(url, key);

  try {
    console.log('📋 Criando bolão de exemplo...');

    // 1. Obter usuário autenticado
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error('❌ Usuário não autenticado. Faça login primeiro.');
      process.exit(1);
    }

    const userId = session.user.id;

    // 2. Criar bolão
    const { data: pool, error: poolError } = await supabase
      .from('pools')
      .insert({ name: 'Bolão Teste Copa 2026', owner_id: userId })
      .select()
      .single();

    if (poolError) throw poolError;
    console.log('✅ Bolão criado:', pool.id);

    // 3. Obter IDs de times e grupos
    const { data: teams } = await supabase.from('teams').select('id, name');
    const { data: groups } = await supabase.from('groups').select('id, code');

    const teamMap = Object.fromEntries(teams.map(t => [t.name, t.id]));
    const groupMap = Object.fromEntries(groups.map(g => [g.code, g.id]));

    // 4. Criar rounds e matches
    let roundCount = 0;
    let matchCount = 0;

    for (const [groupCode, rounds] of Object.entries(matchesByGroup)) {
      const groupId = groupMap[groupCode];
      const kickoffDates = [
        '2026-06-10', '2026-06-11', '2026-06-12', '2026-06-13',
        '2026-06-14', '2026-06-15', '2026-06-16', '2026-06-17',
        '2026-06-18', '2026-06-19', '2026-06-20', '2026-06-21',
      ];

      for (let roundIdx = 0; roundIdx < rounds.length; roundIdx++) {
        const roundName = `Grupo ${groupCode} – Rodada ${roundIdx + 1}`;
        const deadline = new Date(kickoffDates[roundIdx * 2]).toISOString();

        const { data: round, error: roundError } = await supabase
          .from('rounds')
          .insert({
            pool_id: pool.id,
            name: roundName,
            phase: 'grupos',
            deadline,
          })
          .select()
          .single();

        if (roundError) throw roundError;
        roundCount++;

        // Inserir matches
        for (const [homeTeam, awayTeam] of rounds[roundIdx]) {
          const kickoff = new Date(kickoffDates[roundIdx * 2] + 'T15:00:00Z').toISOString();

          const { error: matchError } = await supabase
            .from('matches')
            .insert({
              round_id: round.id,
              group_id: groupId,
              home_team_id: teamMap[homeTeam],
              away_team_id: teamMap[awayTeam],
              kickoff_at: kickoff,
            });

          if (matchError) throw matchError;
          matchCount++;
        }
      }
    }

    console.log(`✅ ${roundCount} rodadas criadas`);
    console.log(`✅ ${matchCount} jogos criados`);
    console.log(`\n📌 Pool ID: ${pool.id}`);
    console.log('🚀 Acesse http://localhost:5173 para testar!');
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

createExamplePool();
