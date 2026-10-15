# AH Crédito: banco de dados e publicação na Railway

O sistema é um serviço Node único: entrega o site e a API, e guarda tudo no Postgres da Railway.

## Como funciona
- Site (React) e API (`server/index.js`) saem do mesmo endereço, sem CORS.
- Tabelas criadas sozinhas no primeiro início: `usuarios`, `itens` (clientes, movimentações, histórico e chaves PIX), `links_cadastro` e `documentos`.
- Documentos pessoais (PDF, Word, fotos e outros) ficam no próprio Postgres (coluna `bytea`), vinculados ao cliente. Limites: 10 MB por arquivo e 100 MB por cliente; executáveis e HTML/SVG são bloqueados; só quem está logado baixa. Fotos grandes são reduzidas no navegador antes do envio.
- **Espaço:** os documentos são o que mais ocupa o 1 GB. Com fotos reduzidas (cerca de 0,5 a 1 MB cada), cabem centenas de documentos; PDFs grandes consomem mais. Acompanhe o uso no painel da Railway. Documentos de clientes excluídos definitivamente são apagados junto.
- Login: usuário e senha guardados com hash (bcrypt) e sessão em cookie `httpOnly`.
- Link de cadastro do cliente: código aleatório de uso único guardado no banco. O cadastro preenchido cai direto em Clientes.
- O espaço de 1 GB do Postgres comporta muitos milhares de clientes e movimentações (cada registro ocupa poucos KB).

## Variáveis do serviço (Railway → serviço → Variables)
| Variável | Valor |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (referência ao banco do projeto) |
| `JWT_SECRET` | texto longo e aleatório |
| `ADMIN_USER` | usuário de acesso |
| `ADMIN_PASSWORD` | senha forte (para trocar, altere a variável e reinicie) |

## Publicar
1. No projeto da Railway: **New → Database → PostgreSQL** (se ainda não existir) e **New → GitHub Repo** apontando para este repositório.
2. Preencha as variáveis acima no serviço do site.
3. Em **Settings → Networking → Generate Domain** para gerar o endereço público (ou ligue o domínio próprio).
4. O `railway.json` já define build (`npm run build`), início (`npm start`) e teste de saúde (`/healthz`).

## Rodar no computador (testes)
```
npm install
npm run build
ADMIN_USER=teste ADMIN_PASSWORD=uma-senha npm start
```
Sem `DATABASE_URL`, o servidor usa um Postgres embutido (PGlite) em `./.data`, só para desenvolvimento.

## Backup
Na Railway, ative backups do volume do Postgres, ou exporte periodicamente com `pg_dump "$DATABASE_URL" > backup.sql`.
