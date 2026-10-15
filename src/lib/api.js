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
