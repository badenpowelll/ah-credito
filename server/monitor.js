import crypto from 'node:crypto'
import { q } from './db.js'

/**
 * Monitoramento de SLA (disponibilidade e desempenho).
 * A cada minuto o servidor mede o banco e resume os pedidos do minuto (quantidade, erros 5xx, tempo de resposta)
 * e grava uma linha em monitor_sla. Um minuto SEM linha significa que o servidor estava fora do ar ou sem banco
 * (quem está fora do ar não consegue se registrar), então lacunas contam como indisponibilidade.
 */
const INTERVALO = Number(process.env.MONITOR_INTERVALO_MS) || 60_000
const LIMITE_LENTO_MS = 3000 // banco respondendo mais devagar que isso conta como falha do minuto
export const META_SLA = Number(process.env.SLA_META) || 99.9
const BOOT_ID = crypto.randomUUID()

let pedidos = []

/** Mede o tempo de cada pedido da API (não conta arquivos do site nem o próprio healthz). */
export function middlewareMetricas() {
  return (req, res, next) => {
    if (!req.path.startsWith('/api')) return next()
    const t = process.hrtime.bigint()
    res.on('finish', () => {
      pedidos.push({ ms: Number(process.hrtime.bigint() - t) / 1e6, status: res.statusCode })
      if (pedidos.length > 5000) pedidos.shift()
    })
    next()
  }
}

async function amostrar() {
  const atuais = pedidos
  pedidos = []
  const t0 = process.hrtime.bigint()
  try {
    await q('SELECT 1')
  } catch (e) {
    console.error('monitor: banco não respondeu:', e.message)
    return // sem banco não dá para gravar: a lacuna conta como indisponibilidade
  }
  const latencia = Number(process.hrtime.bigint() - t0) / 1e6
  const ms = atuais.map((x) => x.ms).sort((a, b) => a - b)
  const media = ms.length ? ms.reduce((s, x) => s + x, 0) / ms.length : null
  const p95 = ms.length ? ms[Math.min(ms.length - 1, Math.floor(ms.length * 0.95))] : null
  try {
    await q(
      `INSERT INTO monitor_sla (minuto, ok, latencia_db_ms, requisicoes, erros5xx, lat_media_ms, lat_p95_ms, memoria_mb, boot_id)
       VALUES (date_trunc('minute', now()), $1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (minuto) DO UPDATE SET
         ok = monitor_sla.ok AND EXCLUDED.ok,
         latencia_db_ms = GREATEST(monitor_sla.latencia_db_ms, EXCLUDED.latencia_db_ms),
         requisicoes = monitor_sla.requisicoes + EXCLUDED.requisicoes,
         erros5xx = monitor_sla.erros5xx + EXCLUDED.erros5xx,
         lat_media_ms = COALESCE(EXCLUDED.lat_media_ms, monitor_sla.lat_media_ms),
         lat_p95_ms = GREATEST(monitor_sla.lat_p95_ms, EXCLUDED.lat_p95_ms),
         memoria_mb = EXCLUDED.memoria_mb`,
      [latencia < LIMITE_LENTO_MS, Math.round(latencia * 10) / 10, atuais.length, atuais.filter((x) => x.status >= 500).length,
        media, p95, Math.round(process.memoryUsage().rss / 1048576), BOOT_ID],
    )
  } catch (e) {
    console.error('monitor: falha ao gravar amostra:', e.message)
  }
}

let ultimaLimpeza = 0
export async function iniciarMonitor() {
  await q("INSERT INTO monitor_eventos (tipo, detalhe) VALUES ('inicio', $1::jsonb)", [JSON.stringify({ bootId: BOOT_ID, node: process.version })]).catch(() => {})
  await amostrar()
  const timer = setInterval(async () => {
    await amostrar()
    if (Date.now() - ultimaLimpeza > 3_600_000) { // guarda 90 dias
      ultimaLimpeza = Date.now()
      await q("DELETE FROM monitor_sla WHERE minuto < now() - interval '90 days'").catch(() => {})
      await q("DELETE FROM monitor_eventos WHERE quando < now() - interval '90 days'").catch(() => {})
    }
  }, INTERVALO)
  timer.unref()
}

export async function registrarDesligamento() {
  await q("INSERT INTO monitor_eventos (tipo, detalhe) VALUES ('desligamento', $1::jsonb)", [JSON.stringify({ bootId: BOOT_ID })]).catch(() => {})
}

/* ---------- análise (função pura, testável) ---------- */
const MIN = 60_000
const dataBR = (ms) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })

/**
 * linhas: [{ minuto: Date|ms, ok, latencia_db_ms, requisicoes, erros5xx, lat_media_ms, lat_p95_ms }]
 * eventos: [{ quando: Date|ms, tipo }]
 * Um período é "indisponível" quando 2 ou mais minutos seguidos não têm amostra boa (1 minuto isolado é tolerância de relógio).
 */
export function analisar(linhas, eventos, agoraMs = Date.now(), meta = META_SLA) {
  const bons = new Set()
  const porMinuto = new Map()
  let primeira = Infinity, ultima = 0
  for (const l of linhas) {
    const m = Math.floor(new Date(l.minuto).getTime() / MIN)
    porMinuto.set(m, l)
    if (l.ok) bons.add(m)
    primeira = Math.min(primeira, m); ultima = Math.max(ultima, m)
  }
  const fimMin = Math.floor(agoraMs / MIN) - 1 // o minuto corrente ainda não foi medido
  const resultado = { meta, janelas: {}, diario: [], incidentes: [], desde: null, ultimaAmostra: null, amostras: linhas.length }
  if (!linhas.length) return resultado
  resultado.desde = new Date(primeira * MIN).toISOString()
  resultado.ultimaAmostra = new Date(ultima * MIN).toISOString()

  // marca os minutos de indisponibilidade (corridas de 2+ minutos sem amostra boa)
  const baixo = new Map()
  const incidentes = []
  let corridaIni = null
  const fechar = (fim) => {
    if (corridaIni === null) return
    const dur = fim - corridaIni + 1
    if (dur >= 2) {
      for (let m = corridaIni; m <= fim; m++) baixo.set(m, true)
      const tinhaAmostraRuim = [...Array(dur).keys()].some((i) => porMinuto.get(corridaIni + i)?.ok === false)
      const reinicio = eventos.some((e) => e.tipo === 'inicio' && new Date(e.quando).getTime() >= corridaIni * MIN - 2 * MIN && new Date(e.quando).getTime() <= (fim + 3) * MIN)
      incidentes.push({
        inicio: new Date(corridaIni * MIN).toISOString(), fim: new Date((fim + 1) * MIN).toISOString(), minutos: dur,
        motivo: reinicio ? 'Reinício do servidor (atualização ou falha)' : tinhaAmostraRuim ? 'Banco de dados lento ou sem resposta' : 'Sem registros do servidor',
      })
    }
    corridaIni = null
  }
  for (let m = primeira; m <= fimMin; m++) {
    if (bons.has(m)) fechar(m - 1)
    else if (corridaIni === null) corridaIni = m
  }
  fechar(fimMin)
  resultado.incidentes = incidentes.reverse().slice(0, 50)

  const janela = (rotulo, ms) => {
    const ini = Math.max(primeira, Math.floor((agoraMs - ms) / MIN))
    let total = 0, fora = 0
    for (let m = ini; m <= fimMin; m++) { total++; if (baixo.has(m)) fora++ }
    let req = 0, err = 0, somaMedia = 0, somaP95 = 0, pesoLat = 0, somaDb = 0, nDb = 0
    for (let m = ini; m <= ultima; m++) {
      const l = porMinuto.get(m)
      if (!l) continue
      req += l.requisicoes || 0; err += l.erros5xx || 0
      if (l.requisicoes && l.lat_media_ms != null) { somaMedia += l.lat_media_ms * l.requisicoes; somaP95 += (l.lat_p95_ms ?? l.lat_media_ms) * l.requisicoes; pesoLat += l.requisicoes }
      if (l.latencia_db_ms != null) { somaDb += l.latencia_db_ms; nDb++ }
    }
    const reinicios = eventos.filter((e) => e.tipo === 'inicio' && new Date(e.quando).getTime() >= agoraMs - ms).length
    const disp = total ? Math.round(((total - fora) / total) * 100000) / 1000 : 100
    resultado.janelas[rotulo] = {
      minutos: total, minutosFora: fora, disponibilidade: disp, dentroDaMeta: disp >= meta, historicoCurto: total < (ms / MIN) * 0.95,
      requisicoes: req, erros5xx: err, taxaErro: req ? Math.round((err / req) * 10000) / 100 : 0,
      respostaMediaMs: pesoLat ? Math.round(somaMedia / pesoLat) : null, respostaP95Ms: pesoLat ? Math.round(somaP95 / pesoLat) : null,
      bancoMedioMs: nDb ? Math.round((somaDb / nDb) * 10) / 10 : null, reinicios,
    }
  }
  janela('24h', 24 * 60 * MIN); janela('7d', 7 * 24 * 60 * MIN); janela('30d', 30 * 24 * 60 * MIN)

  const dias = new Map()
  for (let m = Math.max(primeira, fimMin - 30 * 24 * 60); m <= fimMin; m++) {
    const d = dataBR(m * MIN)
    const x = dias.get(d) || { total: 0, fora: 0, p95: 0, req: 0 }
    x.total++; if (baixo.has(m)) x.fora++
    const l = porMinuto.get(m)
    if (l?.requisicoes) { x.req += l.requisicoes; x.p95 += (l.lat_p95_ms ?? l.lat_media_ms ?? 0) * l.requisicoes }
    dias.set(d, x)
  }
  resultado.diario = [...dias.entries()].map(([dia, x]) => ({
    dia, minutos: x.total, disponibilidade: Math.round(((x.total - x.fora) / x.total) * 100000) / 1000, respostaP95Ms: x.req ? Math.round(x.p95 / x.req) : null,
  }))
  return resultado
}

export async function calcularSla() {
  const linhas = (await q("SELECT minuto, ok, latencia_db_ms, requisicoes, erros5xx, lat_media_ms, lat_p95_ms FROM monitor_sla WHERE minuto > now() - interval '30 days' ORDER BY minuto")).rows
  const eventos = (await q("SELECT quando, tipo FROM monitor_eventos WHERE quando > now() - interval '30 days' ORDER BY quando")).rows
  return analisar(linhas, eventos)
}
