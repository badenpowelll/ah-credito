/** Cliente da API (mesma origem: o servidor da Railway entrega o site e a API). */
async function chamar(metodo, url, corpo) {
  let r
  try {
    r = await fetch('/api' + url, {
      method: metodo,
      headers: corpo !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
      credentials: 'same-origin',
    })
  } catch {
    const e = new Error('Sem conexão com o servidor.')
    e.status = 0
    throw e
  }
  let dados = null
  try { dados = await r.json() } catch { /* sem corpo */ }
  if (!r.ok) {
    const e = new Error(dados?.erro || 'Falha na comunicação com o servidor.')
    e.status = r.status
    throw e
  }
  return dados
}

export const api = {
  get: (url) => chamar('GET', url),
  post: (url, corpo = {}) => chamar('POST', url, corpo),
  put: (url, corpo) => chamar('PUT', url, corpo),
  del: (url) => chamar('DELETE', url),
}

/** Envia um arquivo (PDF, DOCX, foto, etc.) para o banco, vinculado ao cliente. */
export async function enviarArquivo(clienteId, arquivo) {
  const url = `/api/clientes/${encodeURIComponent(clienteId)}/documentos?nome=${encodeURIComponent(arquivo.name)}&tipo=${encodeURIComponent(arquivo.type || 'application/octet-stream')}`
  let r
  try {
    r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: arquivo, credentials: 'same-origin' })
  } catch {
    throw new Error('Sem conexão com o servidor.')
  }
  let dados = null
  try { dados = await r.json() } catch { /* sem corpo */ }
  if (!r.ok) throw new Error(dados?.erro || 'Falha ao enviar o arquivo.')
  return dados
}

export const urlDocumento = (id, ver = false) => `/api/documentos/${encodeURIComponent(id)}${ver ? '?ver=1' : ''}`
