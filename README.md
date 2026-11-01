# My Money

PWA de finanças pessoais: lançar despesas/receitas em valor + 1 toque, offline-first, sincronizado com Supabase. Especificação: [ARQUITETURA.md](ARQUITETURA.md).

- Produção: https://my-money-azure-sigma.vercel.app
- Repositório: https://github.com/gyoneya/my-money
- Supabase: projeto `gsmrhunybxdflvsvwugz`

## Stack
React + TypeScript + Vite · Tailwind · Dexie (IndexedDB) · Supabase (Postgres + Auth + RLS) · vite-plugin-pwa · Vercel.

## Setup local
1. Node 22+.
2. `npm install`
3. Copie `.env.example` para `.env` e preencha (Supabase → Project Settings → API Keys):
   - `VITE_SUPABASE_URL` = `https://<project-id>.supabase.co`
   - `VITE_SUPABASE_KEY` = chave **publishable** (ou `anon`). **Nunca** a `secret`/`service_role`.
4. `npm run dev` → http://localhost:5173

## Supabase (uma vez)
1. Criar projeto (Postgres padrão; Data API ligada; "Automatically expose new tables" desligado; RLS automático ligado).
2. SQL Editor → rodar [supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql).
3. Authentication → Users → **Add user** (e-mail + senha, marcar **Auto Confirm User**).
4. Authentication → Sign In / Providers → desligar **Allow new users to sign up**.

## Comandos
| Comando | O quê |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm test` | testes unitários (Vitest) |
| `npm run build` | checagem de tipos + build de produção (com service worker) |
| `npm run preview` | servir o build localmente |
| `node scripts/make-icons.mjs` | regerar ícones em `public/icons` |

## Deploy (Vercel)
1. Repositório **privado** no GitHub.
2. Vercel → Add New Project → importar o repo (framework Vite detectado).
3. Environment Variables: `VITE_SUPABASE_URL` e `VITE_SUPABASE_KEY`.
4. Cada push na `main` publica automaticamente. `vercel.json` faz todas as rotas caírem no `index.html`.

## Instalar no celular
- **iPhone**: Safari → Compartilhar → Adicionar à Tela de Início.
- **Android**: Chrome → menu → Instalar app.
