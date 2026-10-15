import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import express from 'express'
import jwt from 'jsonwebtoken'
import { emTransacao, iniciarDb, q } from './db.js'

const aqui = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(aqui, '..', 'dist')
const PRODUCAO = process.env.NODE_ENV === 'production'
const PORTA = Number(process.env.PORT) || 3000
const COLECOES = new Set(['debtors', 'transactions', 'logs', 'pix'])
const COOKIE = 'ahc_sessao'
const DURACAO_SESSAO = 60 * 60 * 24 * 7 // 7 dias

if (PRODUCAO && !process.env.JWT_SECRET) {
  console.error('Defina a variável JWT_SECRET (texto longo e aleatório) para iniciar em produção.')
  process.exit(1)
}
const HASH_FALSO = bcrypt.hashSync('usuario-inexistente', 10)
const SEGREDO = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex')

const app = express()
app.set('trust proxy', 1)
app.disable('x-powered-by')
app.use(express.json({ limit: '200kb' }))
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY' })
  next()
})

/* ---------- utilitários ---------- */
const hojeBR = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })

function limitador(max, janelaMs) {
  const mapa = new Map()
  return (req, res, next) => {
    const agora = Date.now()
    const e = mapa.get(req.ip)
    if (!e || agora - e.t > janelaMs) mapa.set(req.ip, { n: 1, t: agora })
    else if (++e.n > max) return res.status(429).json({ erro: 'Muitas tentativas. Aguarde alguns minutos.' })
    next()
  }
}
const limiteLogin = limitador(10, 10 * 60 * 1000)
const limiteCadastro = limitador(20, 60 * 60 * 1000)

function lerCookie(req, nome) {
  const bruto = req.headers.cookie || ''
  for (const parte of bruto.split(';')) {
    const [k, ...v] = parte.trim().split('=')
    if (k === nome) return decodeURIComponent(v.join('='))
  }
  return null
}

function exigeLogin(req, res, next) {
  try {
    const t = lerCookie(req, COOKIE)
    req.usuario = jwt.verify(t, SEGREDO).sub
    next()
  } catch {
    res.status(401).json({ erro: 'Sessão expirada. Entre novamente.' })
  }
}

const asyncRota = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error(e)
  res.status(500).json({ erro: 'Erro interno do servidor.' })
})

/* ---------- autenticação ---------- */
app.post('/api/login', limiteLogin, asyncRota(async (req, res) => {
  const usuario = String(req.body?.usuario || '').trim().toLowerCase()
  const senha = String(req.body?.senha || '')
  const r = await q('SELECT senha_hash FROM usuarios WHERE usuario = $1', [usuario])
  // compara sempre, para não revelar se o usuário existe pelo tempo de resposta
  const hash = r.rows[0]?.senha_hash || HASH_FALSO
  const ok = await bcrypt.compare(senha, hash)
  if (!r.rows[0] || !ok) return res.status(401).json({ erro: 'Usuário ou senha incorretos.' })
  const token = jwt.sign({ sub: usuario }, SEGREDO, { expiresIn: DURACAO_SESSAO })
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: PRODUCAO, maxAge: DURACAO_SESSAO * 1000, path: '/' })
  res.json({ usuario })
}))

app.post('/api/logout', (req, res) => {
  res.clearCookie(COOKIE, { path: '/' })
  res.json({ ok: true })
})

app.get('/api/me', exigeLogin, (req, res) => res.json({ usuario: req.usuario }))

/* ---------- dados do sistema ---------- */
app.get('/api/data', exigeLogin, asyncRota(async (req, res) => {
  const r = await q('SELECT colecao, dados FROM itens ORDER BY ordem DESC')
  const saida = { debtors: [], transactions: [], logs: [], pix: [] }
  for (const l of r.rows) if (saida[l.colecao]) saida[l.colecao].push(l.dados)
  saida.pix.reverse() // chaves PIX: a mais antiga primeiro (é a padrão nas mensagens)
  res.json(saida)
}))

app.put('/api/c/:colecao/:id', exigeLogin, asyncRota(async (req, res) => {
  const { colecao, id } = req.params
  if (!COLECOES.has(colecao)) return res.status(404).json({ erro: 'Coleção inválida.' })
  const item = req.body
  if (!item || typeof item !== 'object' || Array.isArray(item) || item.id !== id || id.length > 64) {
    return res.status(400).json({ erro: 'Dados inválidos.' })
  }
  await q(
    `INSERT INTO itens (colecao, id, dados) VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (colecao, id) DO UPDATE SET dados = EXCLUDED.dados, atualizado_em = now()`,
    [colecao, id, JSON.stringify(item)],
  )
  res.json({ ok: true })
}))

app.delete('/api/c/:colecao/:id', exigeLogin, asyncRota(async (req, res) => {
  const { colecao, id } = req.params
  if (!COLECOES.has(colecao)) return res.status(404).json({ erro: 'Coleção inválida.' })
  await q('DELETE FROM itens WHERE colecao = $1 AND id = $2', [colecao, id])
  res.json({ ok: true })
}))

/* ---------- link de cadastro do cliente ---------- */
app.post('/api/links', exigeLogin, asyncRota(async (req, res) => {
  const n = (v) => Math.max(0, Number(v) || 0)
  const dados = {
    v: n(req.body?.v),
    j: n(req.body?.j),
    d: Math.min(31, Math.max(1, parseInt(req.body?.d, 10) || 1)),
    f: Boolean(req.body?.f),
  }
  const token = crypto.randomBytes(16).toString('base64url')
  await q('INSERT INTO links_cadastro (token, dados) VALUES ($1, $2::jsonb)', [token, JSON.stringify(dados)])
  res.json({ token })
}))

app.get('/api/public/cadastro/:token', limiteCadastro, asyncRota(async (req, res) => {
  const r = await q('SELECT dados, usado_em FROM links_cadastro WHERE token = $1', [req.params.token])
  if (!r.rows[0]) return res.status(404).json({ erro: 'Link inválido.' })
  if (r.rows[0].usado_em) return res.status(410).json({ erro: 'Este link já foi utilizado.' })
  res.json(r.rows[0].dados)
}))

const CAMPOS_CLIENTE = ['nome', 'cpf', 'rg', 'telefone', 'email', 'cep', 'endereco', 'numero', 'complemento', 'cidade', 'tipoEndereco']
const texto = (v, max = 200) => String(v ?? '').trim().slice(0, max)

app.post('/api/public/cadastro/:token', limiteCadastro, asyncRota(async (req, res) => {
  const cliente = {}
  for (const c of CAMPOS_CLIENTE) cliente[c] = texto(req.body?.[c])
  cliente.tipoEndereco = cliente.tipoEndereco === 'Trabalho' ? 'Trabalho' : 'Residencial'
  if (!cliente.nome || !cliente.cpf || !cliente.telefone) {
    return res.status(400).json({ erro: 'Preencha nome, CPF e telefone.' })
  }
  const resultado = await emTransacao(async (tx) => {
    const link = await tx(
      'UPDATE links_cadastro SET usado_em = now() WHERE token = $1 AND usado_em IS NULL RETURNING dados',
      [req.params.token],
    )
    if (!link.rows[0]) return null
    const t = link.rows[0].dados
    const id = crypto.randomBytes(8).toString('hex')
    const debtor = {
      ...cliente,
      id,
      valorEmprestado: t.v,
      valorParcela: t.j,
      jurosPct: t.v ? +((t.j / t.v) * 100).toFixed(2) : 0,
      diaVencimento: t.d,
      pagos: [],
      criadoEm: hojeBR(),
      viaLink: true,
    }
    await tx('INSERT INTO itens (colecao, id, dados) VALUES ($1, $2, $3::jsonb)', ['debtors', id, JSON.stringify(debtor)])
    return true
  })
  if (!resultado) return res.status(410).json({ erro: 'Link inválido ou já utilizado.' })
  res.json({ ok: true })
}))

app.get('/healthz', (req, res) => res.send('ok'))
app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }))

/* ---------- site (arquivos gerados pelo build) ---------- */
app.use(express.static(DIST, { index: 'index.html', maxAge: '1h' }))
app.use((req, res) => res.sendFile(path.join(DIST, 'index.html')))

/* ---------- inicialização ---------- */
async function criarAdmin() {
  const usuario = String(process.env.ADMIN_USER || '').trim().toLowerCase()
  const senha = process.env.ADMIN_PASSWORD
  if (!usuario || !senha) {
    const r = await q('SELECT count(*)::int AS n FROM usuarios')
    if (!r.rows[0].n) console.warn('Nenhum usuário cadastrado. Defina ADMIN_USER e ADMIN_PASSWORD para criar o acesso.')
    return
  }
  const hash = await bcrypt.hash(senha, 10)
  await q(
    `INSERT INTO usuarios (usuario, senha_hash) VALUES ($1, $2)
     ON CONFLICT (usuario) DO UPDATE SET senha_hash = EXCLUDED.senha_hash`,
    [usuario, hash],
  )
  console.log(`Usuário "${usuario}" pronto.`)
}

const modo = await iniciarDb()
await criarAdmin()
app.listen(PORTA, () => console.log(`AH Crédito na porta ${PORTA} · banco: ${modo}`))
