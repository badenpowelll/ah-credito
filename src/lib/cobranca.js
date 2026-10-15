import { brl, fmtData, hojeISO, statusDe } from './utils'
import { EMPRESA } from './cadastro'

export const CFG_PADRAO = { ativo: true, diasAntes: 2, repetirAtraso: 3, pixId: '' }

/** Estágio da cobrança de hoje para o cliente, ou null se não há nada a cobrar. */
export function estagioDe(d, cfg, hoje = new Date()) {
  const st = statusDe(d, hoje)
  if (st === 'pago') return null
  const dif = Number(d.diaVencimento) - hoje.getDate()
  if (st === 'atrasado') return { tipo: 'atraso', dias: -dif }
  if (dif === 0) return { tipo: 'hoje', dias: 0 }
  if (dif > 0 && dif <= cfg.diasAntes) return { tipo: 'antes', dias: dif }
  return null
}

export function mensagemCobranca(d, est, pix) {
  const nome = d.nome.split(' ')[0]
  const dados = pix ? `\n\n💳 *PIX* (${pix.titular} — ${pix.banco}):\n${pix.chave}` : ''
  const valor = `*${brl(d.valorParcela)}*`
  if (est.tipo === 'atraso')
    return `🔔 *${EMPRESA}*\n\nOlá, ${nome}! Sua parcela de ${valor} venceu no dia ${d.diaVencimento} e consta em aberto (${est.dias} dia(s) de atraso).\n\nPor favor, regularize o pagamento e envie o comprovante.${dados}\n\n— *${EMPRESA}*`
  if (est.tipo === 'hoje')
    return `🔔 *${EMPRESA}*\n\nOlá, ${nome}! Sua parcela de ${valor} vence *hoje* (dia ${d.diaVencimento}).${dados}\n\nApós pagar, envie o comprovante por aqui. Obrigado!\n\n— *${EMPRESA}*`
  return `🔔 *${EMPRESA}*\n\nOlá, ${nome}! Lembrete: sua parcela de ${valor} vence em ${est.dias} dia(s) (dia ${d.diaVencimento}).${dados}\n\n— *${EMPRESA}*`
}

/** Fila de hoje: quem deve receber cobrança e ainda não recebeu (conforme o histórico de envios). */
export function filaDeCobranca(debtors, logs, cfg, pixKeys, hoje = new Date()) {
  const pix = pixKeys.find((k) => k.id === cfg.pixId) || pixKeys[0]
  const hojeS = hojeISO(hoje)
  return debtors
    .map((d) => {
      const est = estagioDe(d, cfg, hoje)
      if (!est) return null
      const envios = logs.filter((l) => l.debtorId === d.id && l.tipo === 'cobranca').map((l) => hojeISO(new Date(l.data))).sort()
      const ultimo = envios[envios.length - 1]
      let jaEnviado = false
      if (ultimo) {
        if (est.tipo === 'atraso') {
          const dias = Math.floor((new Date(hojeS) - new Date(ultimo)) / 86400000)
          jaEnviado = dias < cfg.repetirAtraso
        } else jaEnviado = ultimo === hojeS
      }
      return { d, est, jaEnviado, ultimo, msg: mensagemCobranca(d, est, pix), semTelefone: !d.telefone }
    })
    .filter(Boolean)
    .sort((a, b) => (b.est.tipo === 'atraso') - (a.est.tipo === 'atraso') || (a.est.tipo === 'atraso' ? b.est.dias - a.est.dias : a.est.dias - b.est.dias))
}

export const rotuloEstagio = (e) =>
  e.tipo === 'atraso' ? `Atrasado há ${e.dias} dia(s)` : e.tipo === 'hoje' ? 'Vence hoje' : `Vence em ${e.dias} dia(s)`
export { fmtData }
