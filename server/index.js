import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import express from 'express'
import jwt from 'jsonwebtoken'
import { calcular } from '../shared/parcelas.js'
import { diferenca, registrar, rotasAuditoria, rotuloDe } from './auditoria.js'
import { emTransacao, encerrarDb, iniciarDb, q } from './db.js'

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
  // Referrer-Policy: o mapa precisa identificar o site (o OpenStreetMap recusa pedidos sem Referer)
  res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'DENY' })
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
  const r = await q('SELECT senha_hash, papel FROM usuarios WHERE usuario = $1', [usuario])
  // compara sempre, para não revelar se o usuário existe pelo tempo de resposta
  const hash = r.rows[0]?.senha_hash || HASH_FALSO
  const ok = await bcrypt.compare(senha, hash)
  if (!r.rows[0] || !ok) {
    await registrar(req, 'login_falhou', { usuario: usuario.slice(0, 80), detalhe: { motivo: r.rows[0] ? 'senha incorreta' : 'usuário inexistente' } })
    return res.status(401).json({ erro: 'Usuário ou senha incorretos.' })
  }
  const token = jwt.sign({ sub: usuario }, SEGREDO, { expiresIn: DURACAO_SESSAO })
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: PRODUCAO, maxAge: DURACAO_SESSAO * 1000, path: '/' })
  await q('UPDATE usuarios SET ultimo_acesso = now() WHERE usuario = $1', [usuario])
  await registrar(req, 'login', { usuario })
  res.json({ usuario, papel: r.rows[0].papel })
}))

app.post('/api/logout', async (req, res) => {
  try { await registrar(req, 'logout', { usuario: jwt.verify(lerCookie(req, COOKIE), SEGREDO).sub }) } catch { /* sessão já vencida */ }
  res.clearCookie(COOKIE, { path: '/' })
  res.json({ ok: true })
})

app.get('/api/me', exigeLogin, asyncRota(async (req, res) => {
  const r = await q('SELECT papel FROM usuarios WHERE usuario = $1', [req.usuario])
  if (!r.rows[0]) return res.status(401).json({ erro: 'Sessão expirada. Entre novamente.' })
  res.json({ usuario: req.usuario, papel: r.rows[0].papel })
}))

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
  const anterior = (await q('SELECT dados FROM itens WHERE colecao = $1 AND id = $2', [colecao, id])).rows[0]?.dados
  await q(
    `INSERT INTO itens (colecao, id, dados) VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (colecao, id) DO UPDATE SET dados = EXCLUDED.dados, atualizado_em = now()`,
    [colecao, id, JSON.stringify(item)],
  )
  if (!anterior) await registrar(req, 'criar', { entidade: colecao, id, detalhe: { item: rotuloDe(item) } })
  else {
    const { campos, mudou } = diferenca(anterior, item)
    if (campos.length) await registrar(req, 'alterar', { entidade: colecao, id, detalhe: { item: rotuloDe(item), campos, mudou } })
  }
  res.json({ ok: true })
}))

app.delete('/api/c/:colecao/:id', exigeLogin, asyncRota(async (req, res) => {
  const { colecao, id } = req.params
  if (!COLECOES.has(colecao)) return res.status(404).json({ erro: 'Coleção inválida.' })
  const anterior = (await q('SELECT dados FROM itens WHERE colecao = $1 AND id = $2', [colecao, id])).rows[0]?.dados
  await q('DELETE FROM itens WHERE colecao = $1 AND id = $2', [colecao, id])
  if (colecao === 'debtors') await q('DELETE FROM documentos WHERE cliente_id = $1', [id]) // exclusão definitiva leva os documentos junto
  if (anterior) await registrar(req, 'excluir', { entidade: colecao, id, detalhe: { item: rotuloDe(anterior) } })
  res.json({ ok: true })
}))

/* ---------- documentos pessoais dos clientes (guardados no Postgres) ---------- */
const MAX_DOC = 10 * 1024 * 1024 // 10 MB por arquivo
const COTA_CLIENTE = 100 * 1024 * 1024 // 100 MB por cliente
const EXT_BLOQUEADAS = new Set(['exe', 'bat', 'cmd', 'com', 'scr', 'msi', 'js', 'mjs', 'vbs', 'vbe', 'ps1', 'sh', 'jar', 'dll', 'html', 'htm', 'svg', 'php', 'apk'])
const VER_NO_NAVEGADOR = /^(image\/(jpeg|png|gif|webp)|application\/pdf)$/
const corpoBruto = express.raw({ type: () => true, limit: MAX_DOC + 1024 })
const CARACTERES_INVALIDOS = new RegExp('[\\\\/:*?"<>|\\u0000-\\u001f]', 'g')

const limpaNome = (n) => String(n || 'documento').replace(CARACTERES_INVALIDOS, '_').trim().slice(0, 150) || 'documento'
const extensao = (n) => (n.includes('.') ? n.split('.').pop().toLowerCase() : '')
const infoDoc = (d) => ({ id: d.id, nome: d.nome, tipo: d.tipo, tamanho: Number(d.tamanho), criadoEm: d.criado_em })

app.get('/api/clientes/:id/documentos', exigeLogin, asyncRota(async (req, res) => {
  const r = await q('SELECT id, nome, tipo, tamanho, criado_em FROM documentos WHERE cliente_id = $1 ORDER BY criado_em DESC', [req.params.id])
  res.json(r.rows.map(infoDoc))
}))

// O arquivo vai no corpo da requisição; nome e tipo vão na URL (?nome=...&tipo=...).
app.post('/api/clientes/:id/documentos', exigeLogin, corpoBruto, asyncRota(async (req, res) => {
  const nome = limpaNome(req.query.nome)
  const tipo = String(req.query.tipo || 'application/octet-stream').slice(0, 100)
  const dados = req.body
  if (!Buffer.isBuffer(dados) || !dados.length) return res.status(400).json({ erro: 'Arquivo vazio.' })
  if (dados.length > MAX_DOC) return res.status(413).json({ erro: 'Arquivo maior que 10 MB.' })
  if (EXT_BLOQUEADAS.has(extensao(nome))) return res.status(400).json({ erro: 'Este tipo de arquivo não é permitido.' })
  const usado = await q('SELECT COALESCE(SUM(tamanho), 0)::bigint AS total FROM documentos WHERE cliente_id = $1', [req.params.id])
  if (Number(usado.rows[0].total) + dados.length > COTA_CLIENTE) return res.status(413).json({ erro: 'Limite de 100 MB de documentos deste cliente atingido.' })
  const id = crypto.randomBytes(12).toString('hex')
  await q('INSERT INTO documentos (id, cliente_id, nome, tipo, tamanho, dados) VALUES ($1, $2, $3, $4, $5, $6)', [id, req.params.id, nome, tipo, dados.length, dados])
  await registrar(req, 'documento_enviar', { entidade: 'documentos', id, detalhe: { cliente: req.params.id, nome, tamanho: dados.length } })
  res.json({ id, nome, tipo, tamanho: dados.length })
}))

app.get('/api/documentos/:id', exigeLogin, asyncRota(async (req, res) => {
  const r = await q('SELECT nome, tipo, dados FROM documentos WHERE id = $1', [req.params.id])
  const d = r.rows[0]
  if (!d) return res.status(404).json({ erro: 'Documento não encontrado.' })
  const ver = req.query.ver === '1' && VER_NO_NAVEGADOR.test(d.tipo)
  res.set({
    'Content-Type': ver ? d.tipo : 'application/octet-stream',
    'Content-Disposition': `${ver ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(d.nome)}`,
    'Cache-Control': 'private, no-store',
  })
  await registrar(req, ver ? 'documento_ver' : 'documento_baixar', { entidade: 'documentos', id: req.params.id, detalhe: { nome: d.nome } })
  res.send(Buffer.from(d.dados))
}))

app.delete('/api/documentos/:id', exigeLogin, asyncRota(async (req, res) => {
  const d = (await q('SELECT nome, cliente_id FROM documentos WHERE id = $1', [req.params.id])).rows[0]
  await q('DELETE FROM documentos WHERE id = $1', [req.params.id])
  if (d) await registrar(req, 'documento_excluir', { entidade: 'documentos', id: req.params.id, detalhe: { nome: d.nome, cliente: d.cliente_id } })
  res.json({ ok: true })
}))

app.get('/api/armazenamento', exigeLogin, asyncRota(async (req, res) => {
  const r = await q('SELECT COALESCE(SUM(tamanho), 0)::bigint AS total, COUNT(*)::int AS n FROM documentos')
  res.json({ bytesDocumentos: Number(r.rows[0].total), documentos: r.rows[0].n })
}))

/* ---------- link de cadastro do cliente ---------- */
app.post('/api/links', exigeLogin, asyncRota(async (req, res) => {
  const modo = req.body?.modo === 'parcela' ? 'parcela' : 'inicio'
  const c = calcular({ valor: req.body?.v, parcela: req.body?.p, n: req.body?.n, data: req.body?.data, modo })
  if (!c) return res.status(400).json({ erro: 'Confira o valor, a parcela, a quantidade de parcelas (1 a 120) e a data.' })
  if (c.semJuros) return res.status(400).json({ erro: 'As parcelas somam menos que o valor emprestado. Confira o valor da parcela.' })
  // os números derivados são recalculados aqui, no servidor, e não vêm prontos da tela
  const dados = {
    v: c.valor, p: c.parcela, n: c.n, modo, data: req.body.data,
    primeira: c.primeira, ultima: c.ultima, base: c.base, ultimaBase: c.nominais[c.nominais.length - 1], total: c.total, juros: c.juros, jurosPctTotal: c.jurosPctTotal, taxaMes: c.taxaMes,
  }
  const token = crypto.randomBytes(16).toString('base64url')
  await q('INSERT INTO links_cadastro (token, dados) VALUES ($1, $2::jsonb)', [token, JSON.stringify(dados)])
  await registrar(req, 'link_gerar', { entidade: 'links', detalhe: { valor: c.valor, parcelas: c.n, parcela: c.parcela } })
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
    const novo = t.p !== undefined // links antigos (valor + juros mensal + dia) continuam funcionando
    const emprestimo = novo
      ? {
          valorEmprestado: t.v, valorParcela: t.p, jurosPct: t.taxaMes ?? 0, diaVencimento: Number((t.base ?? t.primeira).slice(8, 10)),
          parcelas: t.n, primeiroVencimento: t.base ?? t.primeira, ultimoVencimento: t.ultimaBase ?? t.ultima, totalAPagar: t.total, valorJuros: t.juros,
          jurosPctTotal: t.jurosPctTotal, dataContrato: t.modo === 'inicio' ? t.data : null,
        }
      : { valorEmprestado: t.v, valorParcela: t.j, jurosPct: t.v ? +((t.j / t.v) * 100).toFixed(2) : 0, diaVencimento: t.d }
    const debtor = {
      ...cliente,
      id,
      ...emprestimo,
      pagos: [],
      criadoEm: hojeBR(),
      viaLink: true,
    }
    await tx('INSERT INTO itens (colecao, id, dados) VALUES ($1, $2, $3::jsonb)', ['debtors', id, JSON.stringify(debtor)])
    return true
  })
  if (!resultado) return res.status(410).json({ erro: 'Link inválido ou já utilizado.' })
  await registrar(req, 'cadastro_publico', { usuario: null, entidade: 'debtors', detalhe: { item: cliente.nome } })
  res.json({ ok: true })
}))

rotasAuditoria(app, { exigeLogin, asyncRota, hojeBR })

// Saúde: confirma que o banco responde. Se falhar, devolve 503 e a Railway reinicia o serviço.
app.get('/healthz', async (req, res) => {
  try {
    await q('SELECT 1')
    res.send('ok')
  } catch (e) {
    console.error('healthz: banco não respondeu:', e.message)
    res.status(503).send('banco indisponível')
  }
})

// Backup dos dados (clientes, movimentações, histórico, chaves PIX e a lista de documentos) em JSON.
app.get('/api/backup', exigeLogin, asyncRota(async (req, res) => {
  await registrar(req, 'backup', { entidade: 'sistema' })
  const itens = await q('SELECT colecao, id, dados, ordem FROM itens ORDER BY colecao, ordem')
  const docs = await q('SELECT id, cliente_id, nome, tipo, tamanho, criado_em FROM documentos ORDER BY criado_em')
  res.set({
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Disposition': `attachment; filename="backup-ah-credito-${hojeBR()}.json"`,
    'Cache-Control': 'private, no-store',
  })
  res.send(JSON.stringify({
    sistema: 'AH Crédito', geradoEm: new Date().toISOString(),
    observacao: 'Os arquivos dos documentos não vão neste backup (apenas a lista); eles continuam guardados no banco de dados.',
    itens: itens.rows, documentos: docs.rows,
  }, null, 1))
}))

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

// Conta do analista de sistemas, a única com acesso ao menu Auditoria. ANALISTA_USER e ANALISTA_PASSWORD (a senha vale a cada reinício).
async function criarAnalista() {
  const usuario = String(process.env.ANALISTA_USER || '').trim().toLowerCase()
  const senha = process.env.ANALISTA_PASSWORD
  if (!usuario || !senha) return
  await q(
    'INSERT INTO usuarios (usuario, senha_hash, papel) VALUES ($1, $2, ' + "'analista'" + ') ON CONFLICT (usuario) DO UPDATE SET senha_hash = EXCLUDED.senha_hash, papel = ' + "'analista'",
    [usuario, await bcrypt.hash(senha, 10)],
  )
  console.log('Analista "' + usuario + '" pronto.')
}

// Acessos adicionais (ex.: conta de teste para o cliente): ACESSOS_EXTRAS="usuario:senha;outro:senha2".
// A senha vale a cada reinício; para trocar, mude a variável. Não use ":" nem ";" na senha.
async function criarAcessosExtras() {
  for (const par of String(process.env.ACESSOS_EXTRAS || '').split(';')) {
    const i = par.indexOf(':')
    const usuario = par.slice(0, i).trim().toLowerCase()
    const senha = par.slice(i + 1)
    if (i < 1 || !usuario || !senha) continue
    await q(
      `INSERT INTO usuarios (usuario, senha_hash) VALUES ($1, $2)
       ON CONFLICT (usuario) DO UPDATE SET senha_hash = EXCLUDED.senha_hash`,
      [usuario, await bcrypt.hash(senha, 10)],
    )
    console.log(`Acesso "${usuario}" pronto.`)
  }
}

const modo = await iniciarDb()
await criarAdmin()
await criarAcessosExtras()
await criarAnalista()
const servidor = app.listen(PORTA, () => console.log(`AH Crédito na porta ${PORTA} · banco: ${modo}`))

// Desligamento limpo (a Railway avisa com SIGTERM em cada atualização): termina os pedidos em andamento antes de sair.
const desligar = (sinal) => {
  console.log(`${sinal} recebido: encerrando…`)
  servidor.close(async () => { await encerrarDb(); process.exit(0) })
  setTimeout(() => process.exit(0), 8000).unref()
}
process.on('SIGTERM', () => desligar('SIGTERM'))
process.on('SIGINT', () => desligar('SIGINT'))
// Uma falha solta em um pedido é registrada; o servidor continua atendendo os demais.
process.on('unhandledRejection', (e) => console.error('Falha não tratada:', e))
process.on('uncaughtException', (e) => { console.error('Erro inesperado:', e); desligar('uncaughtException') })
