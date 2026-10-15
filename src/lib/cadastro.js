import { brl, soDigitos } from './utils'

export const EMPRESA = 'AH Crédito'
const PREFIXO_HASH = '#cad-'
const PREFIXO_CODIGO = 'AHC1:'

const b64 = (obj) => btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const desb64 = (s) => {
  const t = s.replace(/-/g, '+').replace(/_/g, '/')
  return JSON.parse(decodeURIComponent(escape(atob(t + '='.repeat((4 - (t.length % 4)) % 4)))))
}

/** Link único: os valores do empréstimo viajam dentro do próprio token (sem servidor). */
export function gerarLink(dados) {
  return location.href.split('#')[0] + PREFIXO_HASH + b64(dados)
}
export function lerTokenDoHash(hash = location.hash) {
  if (!hash.startsWith(PREFIXO_HASH)) return null
  try { return desb64(hash.slice(PREFIXO_HASH.length)) } catch { return null }
}

/** Código que o cliente devolve ao final do cadastro; a empresa cola em "Importar cadastro". */
export const gerarCodigo = (obj) => PREFIXO_CODIGO + b64(obj)
export function lerCodigo(texto) {
  const i = texto.indexOf(PREFIXO_CODIGO)
  if (i < 0) return null
  const m = /^[A-Za-z0-9_-]+/.exec(texto.slice(i + PREFIXO_CODIGO.length))
  try { return m ? desb64(m[0]) : null } catch { return null }
}

export const saudacao = (h = new Date().getHours()) => (h < 12 ? '☀️ Bom dia!' : h < 18 ? '🌤️ Boa tarde!' : '🌙 Boa noite!')

export const msgCadastro = (link) =>
  `🔹 *Cadastro ${EMPRESA}*\n\n📌 Por favor, realize seu cadastro clicando no link abaixo.\n\n📌 ${link}\n\n✅ Assim que recebermos seus dados, daremos continuidade ao atendimento.\n\n— *${EMPRESA}*`

export const msgDocumentos = () =>
  `${saudacao()}\n\nPara dar continuidade ao seu atendimento, por favor envie os seguintes documentos:\n\n📸 Frente e verso do seu RG ou CNH (foto nítida)\n🏠 Comprovante de residência atualizado\n\n📌 O comprovante de residência deve estar no seu nome ou no de seus pais, cônjuge (esposo/esposa).\n\n✅ Fico no aguardo!`

export const resumoEmprestimo = (t) =>
  `${brl(t.v)} emprestados · juros de ${brl(t.j)} · vencimento ${t.f ? 'fixo, todo dia ' : 'dia '}${t.d}`

export const telefoneWhats = (tel) => {
  const n = soDigitos(tel)
  return n.length && n.length <= 11 ? '55' + n : n
}
