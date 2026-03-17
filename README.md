## Sistema Imobiliário Profissional

Sistema completo de CRM e CMS para venda de imóveis na planta, focado em alta performance e escalabilidade.

## 🚀 Tecnologias
- **Frontend**: Next.js 14 (App Router), TypeScript, TailwindCSS, Shadcn UI
- **Backend**: Supabase (Postgres, Auth, Storage)
- **Estado**: Zustand + TanStack Query
- **Integrações**: ViaCEP, Google Maps, WhatsApp, Resend, Cloudery

## 🛠️ Instalação Local

1. Clone o repositório:
   ```bash
   git clone <url-do-seu-repo>
   cd appimoveis
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Configure as variáveis de ambiente (`.env.local`):
   ```env
   SUPABASE_URL=<SEUS DADOS AQUI>
   SUPABASE_ANON_KEY=<SEUS DADOS AQUI>
   SUPABASE_SERVICE_ROLE_KEY=<SEUS DADOS AQUI>
   SUPABASE_DB_PASSWORD=<SEUS DADOS AQUI>
   SUPABASE_PROJECT_ID=<SEUS DADOS AQUI>

   NEXT_PUBLIC_SUPABASE_URL=<SEUS DADOS AQUI>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<SEUS DADOS AQUI>

   CLOUDINARY_CLOUD_NAME=<SEUS DADOS AQUI>
   CLOUDINARY_API_KEY=<SEUS DADOS AQUI>
   CLOUDINARY_API_SECRET=<SEUS DADOS AQUI>
   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=<SEUS DADOS AQUI>

   RESEND_API_KEY=<SEUS DADOS AQUI>
   ```

4. Rode o projeto:
   ```bash
   npm run dev
   ```

## 🔐 Configuração do Administrador Mestre

Para criar o primeiro acesso com poder total:
1. Vá para `/register` e crie uma conta.
2. No dashboard do Supabase, execute o seguinte comando SQL para tornar seu usuário um Administrador (`hakunaadm`):
   ```sql
   UPDATE public.profiles SET role = 'hakunaadm' WHERE id = 'SEU_USER_ID_AQUI';
   ```
   *Ou use o e-mail:*
   ```sql
   UPDATE public.profiles SET role = 'hakunaadm' WHERE id IN (SELECT id FROM auth.users WHERE email = 'seu@email.com');
   ```

## 📑 Funcionalidades Principais

### CMS Dinâmico (Admin)
- No menu **CMS/Campos**, você pode criar novos atributos (ex: `vista_mar`, `vagas_garagem`).
- Os campos aparecem automaticamente no formulário de cadastro e na página pública do imóvel.

### CRM de Leads
- Todos os contatos feitos via formulário no site são salvos na tabela `leads`.
- Gestores e Administradores podem visualizar e gerenciar o status dos leads.

### SEO e Performance
- Slugs amigáveis gerados automaticamente: `/imoveis/apartamento-curitiba-pr-pilarzinho-imo-0001`.
- Meta tags dinâmicas para redes sociais e buscadores.

## ☁️ Deploy na Vercel
1. Conecte seu repositório Git à Vercel.
2. Adicione as variáveis de ambiente do Supabase.
3. O deploy será automático a cada `git push`.
