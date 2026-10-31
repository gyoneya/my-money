# App de Finanças Pessoais — Arquitetura v0.2

## Objetivo
Registrar despesas e receitas numa **caixa única** (sem contas, sem cartões) com o **menor atrito possível**, e responder no próprio app: **"quanto já gastei e quanto ainda posso gastar?"**
Prioridade 1: lançamento rápido. Prioridade 2: análise dentro do app (sem BI externo).

## Princípios
1. Lançar em **valor + 1 toque** a partir do ícone do app.
2. App abre **direto na tela de lançamento**.
3. Funciona **offline**; sincroniza quando houver conexão.
4. Usuário único. Sem multi-conta, sem cartões, sem bancos.
5. Nenhuma feature pode adicionar passo **obrigatório** ao lançamento.
6. Toda análise acontece **no app**. Nenhuma dependência de Power BI/Excel.

## Plataforma
**PWA (Progressive Web App)** — um código só para iOS, Android e navegador desktop.
- Instalável na tela inicial (iOS: Safari → Compartilhar → Adicionar à Tela de Início; Android: Chrome → Instalar).
- `display: standalone`, `start_url` = tela de lançamento.
- Sem App Store / Play Store.

## Stack
| Camada | Escolha |
|---|---|
| Front | React + TypeScript + Vite |
| PWA | vite-plugin-pwa (Workbox) |
| UI | Tailwind CSS |
| Gráficos | Recharts |
| Datas | date-fns (locale pt-BR) |
| Armazenamento local / offline | Dexie (IndexedDB) |
| Backend / BD | Supabase (Postgres + Auth + RLS), plano free |
| Código | Repositório **privado** no GitHub |
| Hospedagem | Vercel (deploy automático a partir do repo privado) |

## Regras de negócio
- **Saldo inicial = 0.** Saldo = Σ receitas − Σ despesas realizadas desde o primeiro lançamento.
- **Cartão de crédito**: despesa lançada na **data da compra** (regime de competência). Não existe conceito de fatura.
- **Parcelamento**: compra em N parcelas gera N lançamentos ligados por `installment_group_id`.
  - Parcela *i* (1..N) em `data_compra + (i−1) meses` (se o dia não existir no mês, usar o último dia).
  - Valor = total ÷ N em centavos; a diferença de arredondamento vai para a 1ª parcela.
  - Nota automática: `"3/10"`.
  - Editar/excluir oferece: "só esta parcela" ou "todas as parcelas".
- **Recorrentes** (aluguel, assinaturas, salário): regra que gera lançamentos `planned` para os próximos 12 meses.
  - `planned` com data ≤ hoje vira `done` automaticamente; valor editável (ex.: conta de luz varia).
  - Editar a regra recria os `planned` futuros.
- **Status**: `done` (realizado) e `planned` (previsto: parcelas futuras e recorrentes futuras).
  - Parcelas futuras também são `planned` até a data chegar.

## Tela 1 — Lançar (principal)
```
[ Despesa | Receita ]          toggle, default = Despesa
        R$ 0,00                display grande
[ grade de categorias ][ + ]   botões grandes (ícone + nome), 4 colunas; "+" cria categoria
[ 1 ][ 2 ][ 3 ]
[ 4 ][ 5 ][ 6 ]                teclado numérico PRÓPRIO (não o do sistema)
[ 7 ][ 8 ][ 9 ]
[00 ][ 0 ][ ⌫ ]
[ 📅 Hoje ] [ 1x ] [ ✎ Nota ]  opcionais, discretos
```
Fluxo:
1. Digita valor (entrada estilo banco: `1 2 3 4` → `R$ 12,34`). Em compra parcelada, o valor digitado é o **total**.
2. Toca na categoria → **salva imediatamente**.
3. Feedback: vibração + toast `R$ 12,34 · Mercado ✓ [Desfazer]` (~5 s).
4. Tela reseta (data volta para hoje, parcelas para 1x).

Regras:
- **Data**: default hoje (fuso America/Sao_Paulo). Toque → Ontem / Anteontem / calendário.
- **Parcelas** (só despesa): toque em `1x` → seletor rápido À vista–12x + campo "Outro" (13–60x); mostra `10x de R$ 120,00`.
- **Nota**: opcional, antes de tocar na categoria.
- **"+" na grade**: modal mínimo (nome + ícone opcional) → cria categoria do tipo atual e já seleciona/salva o lançamento se houver valor digitado.
- Teclado próprio porque o iOS não abre o teclado do sistema automaticamente; fallback de acessibilidade: `<input inputmode="decimal">`.
- Categoria tocada sem valor = não salva (shake no display).

## Tela 2 — Extrato
- Lista do mês, agrupada por dia; seletor de mês.
- Itens `planned` aparecem esmaecidos com ícone de relógio.
- Toque no item → editar/excluir (com escolha "só esta / todas" para parcelas).
- Indicador discreto de itens não sincronizados.

## Tela 3 — Análise (aba própria)
Seletor de mês (default = atual). Blocos, nesta ordem:
1. **Posso gastar?** (destaque)
   - `Disponível no mês = receitas do mês (done + planned) − despesas done − despesas planned do mês`
   - Mostra também: gasto até hoje, previsto até o fim do mês, % do orçamento total consumido.
2. **Resumo do mês**: receitas, despesas, saldo do mês, saldo acumulado.
3. **Por categoria**: barras gasto vs. orçamento (cor: verde < 80%, amarelo 80–100%, vermelho > 100%). Toque → extrato filtrado.
4. **Compromissos futuros**: barras dos próximos 12 meses com parcelas + recorrentes já previstas.
5. **Simulador de compra**: valor + nº de parcelas (+ data, default hoje) → mostra, sem salvar:
   - **Mês atual** (destaque): "Disponível" antes → depois da compra (1x = valor cheio; parcelado = 1ª parcela).
   - **Meses seguintes**: "Disponível" antes → depois em cada mês com parcela; alerta vermelho em qualquer mês que fique negativo.
   - Botão "Lançar esta compra" → cria o lançamento parcelado direto do simulador.
6. **Evolução**: receitas vs. despesas dos últimos 12 meses.

Layout responsivo: 1 coluna no celular; grade de 2–3 colunas no desktop.

## Tela 4 — Config
- Categorias: criar, renomear, ícone, ordem (arrastar), arquivar. Orçamento mensal por categoria (opcional).
- Recorrentes: criar/editar/encerrar.
- Exportar CSV, sair.

## Modelo de dados (Postgres / Supabase)
```sql
create table categories (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  kind text not null check (kind in ('expense','income')),
  name text not null,
  icon text,
  sort_order int not null default 0,
  monthly_budget_cents bigint,          -- opcional; mesmo limite todo mês
  archived boolean not null default false,
  updated_at timestamptz not null default now()
);

create table recurring_rules (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  kind text not null check (kind in ('expense','income')),
  amount_cents bigint not null check (amount_cents > 0),
  category_id uuid not null references categories(id),
  day_of_month int not null check (day_of_month between 1 and 31),
  start_month date not null,            -- primeiro dia do mês
  end_month date,                       -- null = sem fim
  note text,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table transactions (
  id uuid primary key,                  -- gerado no cliente (offline)
  user_id uuid not null references auth.users(id),
  kind text not null check (kind in ('expense','income')),
  status text not null default 'done' check (status in ('done','planned')),
  amount_cents bigint not null check (amount_cents > 0),
  category_id uuid not null references categories(id),
  occurred_on date not null,
  note text,
  installment_group_id uuid,            -- parcelas da mesma compra
  installment_number int,               -- 1..N
  installment_total int,                -- N
  recurring_rule_id uuid references recurring_rules(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz                -- soft delete (necessário para sync)
);
create index on transactions (user_id, occurred_on);
```
- Valores sempre em **centavos inteiros**. Nunca float.
- RLS em todas as tabelas: `user_id = auth.uid()`.
- Seed das categorias no primeiro login.
- Cálculos da Análise feitos no cliente sobre os dados locais (Dexie), para funcionar offline.

## Offline e sync
- Toda escrita vai primeiro ao IndexedDB com flag `pending`.
- Sync envia ao Supabase quando online (upsert por `id`) e ao abrir o app.
- Pull: registros com `updated_at > last_sync`.
- Conflito: last-write-wins por `updated_at`.
- Promoção `planned → done` roda ao abrir o app.

## Autenticação
- Supabase Auth com **e-mail e senha**. O usuário é criado no painel do Supabase (Add user, Auto Confirm); cadastro pelo app desligado.
  - Motivo: OTP exige editar o template de e-mail, o que no plano free pede SMTP próprio; magic link no iOS abre no Safari, fora do PWA.
- Sessão persistente; login uma vez por dispositivo.

## Categorias iniciais (editáveis)
- **Despesa**: Mercado, Alimentação fora, Transporte, Moradia, Contas, Saúde, Lazer, Compras, Pets, Assinaturas, Educação, Outros.
- **Receita**: Salário, Extra, Vendas, Rendimentos, Outros.

## Fases
1. **MVP — lançar**: PWA instalável, auth e-mail/senha, tela Lançar (com parcelas e "+ categoria"), Extrato, Config de categorias, offline + sync, deploy.
2. **Análise**: aba Análise completa (Posso gastar, resumo, por categoria, compromissos futuros, simulador, evolução), orçamento por categoria, recorrentes.
3. **Refino**: layout desktop caprichado, exportar CSV, ajustes de UX a partir do uso real.

## Identidade visual
- **Tema escuro fixo**, fundo **preto puro** (`#000`, economiza bateria em OLED). Sem tema claro.
- Paleta **pastel**, aplicada no app todo via tokens em `src/index.css`:
  - **Azul pastel**: identidade (seleção, botões, destaques).
  - **Verde pastel**: valores positivos / receitas.
  - **Vermelho pastel**: valores negativos / despesas.
  - **Amarelo pastel**: avisos, pontos que pedem atenção.
- Superfícies (cartões, teclado) em cinza quase preto; nada de fundo azulado.
- **Alcance do polegar** (estilo Samsung One UI): controles mais usados ficam na parte de baixo da tela. Na tela Lançar, a grade de categorias fica alinhada embaixo, logo acima do teclado; data/parcelas/nota ficam no alto, junto do valor.
  - Em listas e painéis, a opção mais usada fica **embaixo à direita** (ex.: "À vista", "Hoje"); opções raras ficam em cima.
  - Avisos (toast com Desfazer) aparecem no meio da tela, não no topo.

## Requisitos não funcionais
- Formatação pt-BR: `R$ 1.234,56`, datas `dd/mm/aaaa`.
- Abertura < 1 s (app shell em cache).
- Apenas a chave `anon` no front; nunca a `service_role`.
- Testes unitários: parsing/formatação de valor, geração de parcelas (arredondamento e fim de mês), geração de recorrentes, cálculo de "Disponível", fila de sync.
- Testar em viewport 390×844 (iPhone) e 360×800 (Android).

## Decisões tomadas
- Cartão: data da compra.
- Parcelado: dividido em parcelas futuras.
- Previsibilidade: orçamento por categoria + recorrentes/projeção + simulador.
- Saldo inicial: zero.
- Análise 100% no app; sem BI externo.

## Decisões de implementação (aprovadas)
- Todas as tabelas têm `server_updated_at` (trigger, relógio do servidor): é o cursor do pull. `updated_at` do cliente decide conflitos.
- Sem DELETE físico: categorias usam `archived`; demais tabelas, `deleted_at`.
- `user_id` com `default auth.uid()`. Push envia categorias antes dos lançamentos.
- Primeiro uso exige login online; seed das categorias só se o servidor não tiver nenhuma.
- "3/10" é exibido a partir de `installment_number/total`; `note` guarda só o texto do usuário.
- Editar "todas as parcelas": categoria/nota em todas; novo valor = novo total redistribuído; nova data desloca todas.
- Saldo = receitas `done` − despesas `done`.
- "Hoje" calculado em America/Sao_Paulo via `Intl`.
- Valor máximo por lançamento: R$ 9.999.999,99.
- Ícone de categoria = emoji. Ordenação na Config por botões ↑↓.
- Tabela de recorrentes já existe na migration; telas na Fase 2. Promoção `planned → done` já na Fase 1.

## Instruções para o Claude Code
- Implementar a Fase 1 nesta ordem: scaffold → migration SQL do Supabase → tela Lançar com Dexie local → parcelas → auth → sync → Extrato → Config de categorias → PWA manifest/service worker → deploy Vercel.
- A tela Lançar é o produto. Polir antes de qualquer outra tela.
- Não adicionar campos obrigatórios ao lançamento.
- Perguntar antes de adicionar dependências além das listadas.
- Segredos em `.env` (fora do Git); documentar setup no README.
