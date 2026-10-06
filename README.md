# Agenda de Food Trucks do Basel

Site estático (GitHub Pages) + Supabase (banco PostgreSQL, login Google e armazenamento de imagens).

Arquivos: `index.html` (site público e painel admin), `admin.js`, `config.js` (suas chaves), `schema.sql` (banco).

## 1. Supabase (banco)
1. Crie uma conta e um projeto em https://supabase.com.
2. SQL Editor > New query > cole o conteúdo de `schema.sql` > Run.
3. Project Settings > API: copie **Project URL** e a chave **anon public** para o `config.js`.

## 2. Login com Google
1. https://console.cloud.google.com > crie um projeto > APIs e serviços > Tela de consentimento OAuth (tipo Externo, preencha o básico).
2. Credenciais > Criar credenciais > ID do cliente OAuth > Aplicativo da Web.
   - Origens JavaScript autorizadas: `https://SEU-USUARIO.github.io`
   - URI de redirecionamento: `https://SEU-PROJETO.supabase.co/auth/v1/callback`
3. Copie o Client ID e o Client Secret.
4. Supabase > Authentication > Providers > Google: ative e cole os dois valores.
5. Supabase > Authentication > URL Configuration:
   - Site URL: `https://SEU-USUARIO.github.io/NOME-DO-REPO/`
   - Redirect URLs: a mesma URL.

Só `felipefreire@gmail.com` escreve no banco: a regra está no banco (`is_admin()`), então outros e-mails não conseguem alterar dados nem pela API.

## 3. GitHub
```
git init
git add .
git commit -m "Agenda de Food Trucks do Basel"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/NOME-DO-REPO.git
git push -u origin main
```
Sem terminal: crie o repositório no github.com, clique em "Add file > Upload files", arraste os 5 arquivos e faça o commit.

Publicar: Settings > Pages > Source: "Deploy from a branch" > Branch `main` / pasta `/ (root)` > Save. Em 1 a 2 minutos o site abre em `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.

## 4. Primeiro uso
1. Abra o site > aba Admin > Entrar com Google.
2. Cadastre parceiros (logo e vários cardápios), crie as regras em "Escala e recorrência" (use a Prévia) e salve. A agenda é gerada para 120 dias.
3. Para atualizar o site depois, edite os arquivos e faça novo commit; o Pages republica sozinho.
