# Recuperação da Agenda Basel

## Rotina
- Aba **Admin > Backup > Backup completo (.sql)**: baixe ao menos 1x por semana (o painel avisa após 7 dias).
- Guarde o arquivo fora do GitHub (ele contém telefones): Drive pessoal, e-mail para si mesmo.
- Guarde também os arquivos originais de logos e cardápios: as imagens NÃO entram no backup.

## Se o projeto Supabase for pausado
Painel do Supabase > selecione o projeto > **Restore project** (há prazo limitado para isso; confira na tela).
O workflow `.github/workflows/keepalive.yml` faz uma leitura diária para evitar a pausa.

## Se o projeto for perdido
1. Crie um projeto novo no Supabase.
2. SQL Editor: rode `schema.sql`, depois `migracao_historico.sql` e `emoji_parceiros.sql` (parte 1).
3. SQL Editor: rode o arquivo `backup-basel-AAAA-MM-DD.sql`.
4. Atualize `config.js` com a nova URL e chave; refaça o login Google (README, passo 2).
5. Reenvie as imagens de logos e cardápios pelo painel (as URLs antigas deixam de existir).
