import { brl, fmtData, soDigitos } from './utils'

export const EMPRESA = 'AH Crédito'
export const saudacao = (h = new Date().getHours()) => (h < 12 ? '☀️ Bom dia!' : h < 18 ? '🌤️ Boa tarde!' : '🌙 Boa noite!')

export const msgCadastro = (link) =>
  `🔹 *Cadastro ${EMPRESA}*\n\n📌 Por favor, realize seu cadastro clicando no link abaixo.\n\n📌 ${link}\n\n✅ Assim que recebermos seus dados, daremos continuidade ao atendimento.\n\n— *${EMPRESA}*`

export const msgDocumentos = () =>
  `${saudacao()}\n\nPara dar continuidade ao seu atendimento, por favor envie os seguintes documentos:\n\n📸 Frente e verso do seu RG ou CNH (foto nítida)\n🏠 Comprovante de residência atualizado\n\n📌 O comprovante de residência deve estar no seu nome ou no de seus pais, cônjuge (esposo/esposa).\n\n✅ Fico no aguardo!`

export const resumoEmprestimo = (t) =>
  t.p !== undefined
    ? `${brl(t.v)} emprestados · ${t.n} parcelas de ${brl(t.p)} · 1ª em ${fmtData(t.primeira)} e última em ${fmtData(t.ultima)}`
    : `${brl(t.v)} emprestados · juros de ${brl(t.j)} · vencimento ${t.f ? 'fixo, todo dia ' : 'dia '}${t.d}`

export const telefoneWhats = (tel) => {
  const n = soDigitos(tel)
  return n.length && n.length <= 11 ? '55' + n : n
}
