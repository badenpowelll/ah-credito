import { q } from './db.js'
import { calcularSla } from './monitor.js'

const INICIADO_EM = new Date()
const PRIMEIRA_LINHA = (v, max = 200) => (v == null ? null : String(v).slice(0, max))

/**
 * Registra uma ação no histórico de auditoria. Nunca interrompe o pedido: se o registro falhar, só avisa no log do servidor.
 * A tabela é só de inclusão: nenhuma rota apaga ou altera registros.
 */
export async function registrar(req, acao, { usuario, entidade, id, detalhe } = {}) {
  try {
    await q(
      'INSERT INTO auditoria (usuario, acao, entidade, entidade_id, detalhe, ip, agente) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)',
      [
        usuario !== undefined ? usuario : req.usuario ?? null,
        acao,
        entidade ?? null,
        id ?? null,
        detalhe ? JSON.stringify(detalhe) : null,
        PRIMEIRA_LINHA(req.ip, 64),
        PRIMEIRA_LINHA(req.headers['user-agent']),
      ],
    )
  } catch (e) {
    console.error('Falha ao registrar auditoria:', e.message)
  }
}

/** Compara dois objetos e devolve os campos que mudaram, com antes e depois (textos curtos). */
export function diferenca(antes, depois) {
  const curto = (v) => {
    const s = typeof v === 'string' ? v : JSON.stringify(v)
    return s === undefined ? null : s.length > 120 ? s.slice(0, 120) + '…' : s
  }
  const mudou = {}
  for (const k of new Set([...Object.keys(antes || {}), ...Object.keys(depois || {})])) {
    if (k === 'id') continue
    if (JSON.stringify(antes?.[k]) !== JSON.stringify(depois?.[k])) mudou[k] = { antes: curto(antes?.[k]), depois: curto(depois?.[k]) }
  }
  return { campos: Object.keys(mudou), mudou }
}

export const rotuloDe = (d) => d?.nome || d?.descricao || d?.titular || (d?.texto ? String(d.texto).slice(0, 60) : '') || ''

function filtros(query) {
  const onde = []
  const p = []
  const add = (sql, v) => { p.push(v); onde.push(sql.replace('?', '$' + p.length)) }
  if (query.usuario) add('usuario = ?', String(query.usuario).toLowerCase())
  if (query.acao) add('acao = ?', String(query.acao))
  if (query.entidade) add('entidade = ?', String(query.entidade))
  if (query.grupo === 'acessos') onde.push("acao IN ('login', 'login_falhou', 'logout', 'acesso_negado')")
  if (/^\d{4}-\d{2}-\d{2}$/.test(query.de || '')) add("(quando AT TIME ZONE 'America/Sao_Paulo')::date >= ?::date", query.de)
  if (/^\d{4}-\d{2}-\d{2}$/.test(query.ate || '')) add("(quando AT TIME ZONE 'America/Sao_Paulo')::date <= ?::date", query.ate)
  if (query.q) add("(coalesce(usuario, '') || ' ' || acao || ' ' || coalesce(entidade, '') || ' ' || coalesce(detalhe::text, '') || ' ' || coalesce(ip, '')) ILIKE ?", '%' + String(query.q).slice(0, 80) + '%')
  return { onde, p }
}

const csv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`

/** Exige login E o papel "analista" (verificado no banco a cada pedido). Quem não é analista fica registrado como acesso negado. */
export function criarExigeAnalista(exigeLogin) {
  return [
    exigeLogin,
    async (req, res, next) => {
      try {
        const r = await q('SELECT papel FROM usuarios WHERE usuario = $1', [req.usuario])
        if (r.rows[0]?.papel === 'analista') return next()
        await registrar(req, 'acesso_negado', { entidade: 'auditoria', detalhe: { rota: req.path } })
        res.status(403).json({ erro: 'Acesso restrito ao analista de sistemas.' })
      } catch (e) {
        console.error(e)
        res.status(500).json({ erro: 'Erro interno do servidor.' })
      }
    },
  ]
}

/** Rotas da auditoria. Todas exigem o papel "analista". */
export function rotasAuditoria(app, { exigeLogin, asyncRota, hojeBR }) {
  const exigeAnalista = criarExigeAnalista(exigeLogin)

  app.get('/api/auditoria', ...exigeAnalista, asyncRota(async (req, res) => {
    const limite = Math.min(200, Math.max(10, parseInt(req.query.limite, 10) || 100))
    const { onde, p } = filtros(req.query)
    const antes = parseInt(req.query.antes, 10)
    if (antes > 0) { p.push(antes); onde.push('id < $' + p.length) }
    const r = await q(
      `SELECT id, quando, usuario, acao, entidade, entidade_id, detalhe, ip, agente FROM auditoria
       ${onde.length ? 'WHERE ' + onde.join(' AND ') : ''} ORDER BY id DESC LIMIT ${limite + 1}`,
      p,
    )
    const itens = r.rows.slice(0, limite).map((l) => ({ ...l, id: Number(l.id) }))
    res.json({ itens, proximo: r.rows.length > limite ? itens[itens.length - 1].id : null })
  }))

  app.get('/api/auditoria/exportar', ...exigeAnalista, asyncRota(async (req, res) => {
    const { onde, p } = filtros(req.query)
    const r = await q(
      `SELECT id, quando, usuario, acao, entidade, entidade_id, detalhe, ip FROM auditoria
       ${onde.length ? 'WHERE ' + onde.join(' AND ') : ''} ORDER BY id DESC LIMIT 5000`,
      p,
    )
    const linhas = [['Nº', 'Quando', 'Usuário', 'Ação', 'Entidade', 'Item', 'Detalhes', 'IP']]
    for (const l of r.rows) {
      linhas.push([l.id, new Date(l.quando).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }), l.usuario, l.acao, l.entidade, l.entidade_id, l.detalhe ? JSON.stringify(l.detalhe) : '', l.ip])
    }
    await registrar(req, 'auditoria_exportar', { entidade: 'auditoria', detalhe: { linhas: r.rows.length } })
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="auditoria-ah-credito-${hojeBR()}.csv"`,
      'Cache-Control': 'private, no-store',
    })
    res.send('﻿' + linhas.map((l) => l.map(csv).join(';')).join('\n'))
  }))

  app.get('/api/auditoria/resumo', ...exigeAnalista, asyncRota(async (req, res) => {
    const total = await q(`SELECT
      count(*) FILTER (WHERE quando > now() - interval '24 hours')::int AS eventos24,
      count(*) FILTER (WHERE acao = 'login' AND quando > now() - interval '24 hours')::int AS logins24,
      count(*) FILTER (WHERE acao = 'login_falhou' AND quando > now() - interval '24 hours')::int AS falhas24,
      count(*) FILTER (WHERE acao IN ('criar', 'alterar', 'excluir') AND quando > now() - interval '24 hours')::int AS alteracoes24,
      count(DISTINCT usuario) FILTER (WHERE acao = 'login' AND quando > now() - interval '24 hours')::int AS usuarios24,
      count(*)::int AS total FROM auditoria`)
    const dias = await q(`SELECT to_char((quando AT TIME ZONE 'America/Sao_Paulo')::date, 'YYYY-MM-DD') AS dia,
      count(*)::int AS eventos,
      count(*) FILTER (WHERE acao IN ('criar', 'alterar', 'excluir'))::int AS alteracoes,
      count(*) FILTER (WHERE acao = 'login_falhou')::int AS falhas
      FROM auditoria WHERE quando > now() - interval '14 days' GROUP BY 1 ORDER BY 1`)
    const acoes = await q("SELECT acao, count(*)::int AS n FROM auditoria WHERE quando > now() - interval '7 days' GROUP BY acao ORDER BY n DESC")
    res.json({ ...total.rows[0], dias: dias.rows, acoes: acoes.rows })
  }))

  app.get('/api/auditoria/usuarios', ...exigeAnalista, asyncRota(async (req, res) => {
    const r = await q(`SELECT u.usuario, u.papel, u.criado_em, u.ultimo_acesso,
      (SELECT count(*)::int FROM auditoria a WHERE a.usuario = u.usuario AND a.acao IN ('criar', 'alterar', 'excluir')) AS alteracoes
      FROM usuarios u ORDER BY u.criado_em`)
    res.json(r.rows)
  }))

  app.get('/api/auditoria/sla', ...exigeAnalista, asyncRota(async (req, res) => res.json(await calcularSla())))

  app.get('/api/auditoria/saude', ...exigeAnalista, asyncRota(async (req, res) => {
    const t0 = process.hrtime.bigint()
    await q('SELECT 1')
    const latenciaMs = Number(process.hrtime.bigint() - t0) / 1e6
    const itens = await q('SELECT colecao, count(*)::int AS n FROM itens GROUP BY colecao')
    const por = Object.fromEntries(itens.rows.map((l) => [l.colecao, l.n]))
    const docs = await q('SELECT count(*)::int AS n, COALESCE(SUM(tamanho), 0)::bigint AS bytes FROM documentos')
    const users = await q('SELECT count(*)::int AS n FROM usuarios')
    const links = await q('SELECT count(*)::int AS gerados, count(usado_em)::int AS usados FROM links_cadastro')
    let bytesBanco = null
    try { bytesBanco = Number((await q('SELECT pg_database_size(current_database())::bigint AS b')).rows[0].b) } catch { /* indisponível neste banco */ }
    res.json({
      banco: 'ok', latenciaMs: Math.round(latenciaMs * 10) / 10,
      iniciadoEm: INICIADO_EM.toISOString(), disponivelHaSegundos: Math.round(process.uptime()),
      node: process.version, memoriaMB: Math.round(process.memoryUsage().rss / 1048576),
      contagens: {
        clientes: por.debtors || 0, movimentacoes: por.transactions || 0, chavesPix: por.pix || 0, historico: por.logs || 0,
        documentos: docs.rows[0].n, usuarios: users.rows[0].n, linksGerados: links.rows[0].gerados, linksUsados: links.rows[0].usados,
      },
      armazenamento: { bytesDocumentos: Number(docs.rows[0].bytes), bytesBanco, limiteBytes: 1024 ** 3 },
    })
  }))
}
