# 🏆 WCP – Bolão Copa do Mundo

Sistema de bolão para a Copa do Mundo. Frontend estático (React + Tailwind) hospedado no GitHub Pages; backend gerenciado pelo Supabase.

## Setup rápido

1. Execute `supabase/migrations/001_schema.sql` e `002_seed_times_grupos.sql` no SQL Editor do Supabase.
2. Copie `.env.example` para `.env` e preencha URL e anon key do projeto.
3. `npm install && npm run dev`

## Deploy GitHub Pages

```bash
npm run deploy
```

Ative GitHub Pages em Settings > Pages > Branch: gh-pages.

## Promoção a admin

```sql
UPDATE profiles SET is_admin = true WHERE email = 'seu@email.com';
```

Veja o README completo no arquivo README.md para detalhes de pontuação, grupos e estrutura.
