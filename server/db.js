import pg from 'pg'

let pool = null
let pglite = null

const ESQUEMA = `
CREATE TABLE IF NOT EXISTS usuarios (
  usuario text PRIMARY KEY,
  senha_hash text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS papel text NOT NULL DEFAULT 'usuario';
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ultimo_acesso timestamptz;
CREATE TABLE IF NOT EXISTS auditoria (
  id bigserial PRIMARY KEY,
  quando timestamptz NOT NULL DEFAULT now(),
  usuario text,
  acao text NOT NULL,
  entidade text,
  entidade_id text,
  detalhe jsonb,
  ip text,
  agente text
);
CREATE INDEX IF NOT EXISTS auditoria_quando_idx ON auditoria (quando DESC);
CREATE INDEX IF NOT EXISTS auditoria_usuario_idx ON auditoria (usuario, id DESC);
CREATE TABLE IF NOT EXISTS itens (
  colecao text NOT NULL,
  id text NOT NULL,
  dados jsonb NOT NULL,
  ordem bigserial,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (colecao, id)
);
CREATE INDEX IF NOT EXISTS itens_colecao_ordem_idx ON itens (colecao, ordem DESC);
CREATE TABLE IF NOT EXISTS monitor_sla (
  minuto timestamptz PRIMARY KEY,
  ok boolean NOT NULL,
  latencia_db_ms real,
  requisicoes int NOT NULL DEFAULT 0,
  erros5xx int NOT NULL DEFAULT 0,
  lat_media_ms real,
  lat_p95_ms real,
  memoria_mb int,
  boot_id text
);
CREATE TABLE IF NOT EXISTS monitor_eventos (
  id bigserial PRIMARY KEY,
  quando timestamptz NOT NULL DEFAULT now(),
  tipo text NOT NULL,
  detalhe jsonb
);
CREATE TABLE IF NOT EXISTS links_cadastro (
  token text PRIMARY KEY,
  dados jsonb NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  usado_em timestamptz
);
CREATE TABLE IF NOT EXISTS documentos (
  id text PRIMARY KEY,
  cliente_id text NOT NULL,
  nome text NOT NULL,
  tipo text NOT NULL,
  tamanho integer NOT NULL,
  dados bytea NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS documentos_cliente_idx ON documentos (cliente_id, criado_em DESC);
`

/**
 * Produção: Postgres da Railway (DATABASE_URL).
 * Desenvolvimento sem DATABASE_URL: banco Postgres embutido (PGlite) em ./.data, só para testes locais.
 */
export async function iniciarDb() {
  if (process.env.DATABASE_URL) {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : undefined,
      max: 5,
    })
    // Erros de conexões ociosas (ex.: reinício do banco) não podem derrubar o servidor; o pool abre outra conexão.
    pool.on('error', (e) => console.error('Conexão com o banco falhou (será refeita):', e.message))
    await pool.query(ESQUEMA)
    return 'postgres'
  }
  const { PGlite } = await import('@electric-sql/pglite')
  pglite = new PGlite(process.env.DEV_DB_DIR || './.data')
  await pglite.exec(ESQUEMA)
  return 'pglite (somente desenvolvimento)'
}

export async function q(texto, params = []) {
  return pool ? pool.query(texto, params) : pglite.query(texto, params)
}

export async function emTransacao(fn) {
  if (pool) {
    const c = await pool.connect()
    try {
      await c.query('BEGIN')
      const r = await fn((t, p = []) => c.query(t, p))
      await c.query('COMMIT')
      return r
    } catch (e) {
      await c.query('ROLLBACK')
      throw e
    } finally {
      c.release()
    }
  }
  return pglite.transaction((tx) => fn((t, p = []) => tx.query(t, p)))
}

export async function encerrarDb() {
  try {
    if (pool) await pool.end()
    else if (pglite) await pglite.close()
  } catch { /* já encerrado */ }
}
