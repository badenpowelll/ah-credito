export const TAMANHO_MAX = 10 * 1024 * 1024 // 10 MB por arquivo (mesmo limite do servidor)
const EXT_BLOQUEADAS = ['exe', 'bat', 'cmd', 'com', 'scr', 'msi', 'js', 'mjs', 'vbs', 'vbe', 'ps1', 'sh', 'jar', 'dll', 'html', 'htm', 'svg', 'php', 'apk']

const extensao = (nome) => (nome.includes('.') ? nome.split('.').pop().toLowerCase() : '')

/** Fotos grandes do celular são reduzidas (lado maior 2200 px, JPEG) para caber mais no banco sem perder a leitura. */
async function reduzirImagem(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 1.5 * 1024 * 1024) return file
  try {
    const bmp = await createImageBitmap(file)
    const esc = Math.min(1, 2200 / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * esc)
    c.height = Math.round(bmp.height * esc)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.drawImage(bmp, 0, 0, c.width, c.height)
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.85))
    if (blob && blob.size < file.size) return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch { /* formato que o navegador não abre (ex.: HEIC): envia o original */ }
  return file
}

/** Valida e prepara os arquivos escolhidos. Devolve { aceitos, recusados: ["nome: motivo"] }. */
export async function prepararArquivos(lista) {
  const aceitos = []
  const recusados = []
  for (const f of Array.from(lista)) {
    if (EXT_BLOQUEADAS.includes(extensao(f.name))) { recusados.push(`${f.name}: tipo de arquivo não permitido`); continue }
    const pronto = await reduzirImagem(f)
    if (pronto.size > TAMANHO_MAX) { recusados.push(`${f.name}: maior que 10 MB`); continue }
    if (!pronto.size) { recusados.push(`${f.name}: arquivo vazio`); continue }
    aceitos.push(pronto)
  }
  return { aceitos, recusados }
}
