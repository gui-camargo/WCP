// Script para resetar resultados reais, palpites e cutoffs dos jogos do bolão
// Uso: node backend/scripts/create-reset-bolao.js

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function resetBolao() {
  // 1. Zerar resultados reais dos jogos
  const { error: updateGamesError } = await supabase
    .from('games')
    .update({ real_home_score: null, real_away_score: null })
    .neq('real_home_score', null);

  if (updateGamesError) {
    console.error('Erro ao zerar resultados reais:', updateGamesError);
    process.exit(1);
  }

  // 2. Apagar todos os palpites
  const { error: deletePredsError } = await supabase
    .from('predictions')
    .delete()
    .neq('id', null);

  if (deletePredsError) {
    console.error('Erro ao apagar palpites:', deletePredsError);
    process.exit(1);
  }


  // 3. Resetar cutoffs dos jogos para 2 horas antes do kickoff_at
  // Isso requer uma query SQL direta, pois Supabase JS não faz update com expressão baseada em outra coluna
  const { error: cutoffSqlError } = await supabase.rpc('reset_cutoff_to_2h_before_kickoff');
  if (cutoffSqlError) {
    console.error('Erro ao resetar cutoffs:', cutoffSqlError);
    process.exit(1);
  }

  console.log('Bolão resetado com sucesso!');
}

resetBolao();
