// Cálculo do parcelamento. Usado pelo servidor (link de cadastro) e pela tela (prévia), para os números baterem.
// Datas sempre como texto "AAAA-MM-DD", sem fuso horário.

const dois = (n) => String(n).padStart(2, '0')
const arred = (n, casas = 2) => Math.round((n + Number.EPSILON) * 10 ** casas) / 10 ** casas

export function dataValida(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return false
  const [a, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(a, m - 1, d))
  return t.getUTCFullYear() === a && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}

/** Soma k meses mantendo o dia (dia 31 vira o último dia dos meses menores). */
export function somaMeses(iso, k) {
  const [a, m, d] = iso.split('-').map(Number)
  const total = a * 12 + (m - 1) + k
  const ano = Math.floor(total / 12)
  const mes = total % 12
  const ultimo = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate()
  return `${ano}-${dois(mes + 1)}-${dois(Math.min(d, ultimo))}`
}

/**
 * Taxa de juros ao mês que faz n parcelas iguais de `parcela` pagarem `valor` (juros compostos, parcelas no fim de cada mês).
 * Devolve 0 se não há juros e null se as parcelas somam menos que o valor.
 */
export function taxaMensal(valor, parcela, n) {
  if (!(valor > 0) || !(parcela > 0) || !(n >= 1)) return null
  const soma = parcela * n
  if (soma < valor - 0.005) return null
  if (Math.abs(soma - valor) < 0.005) return 0
  const f = (i) => parcela * (1 - (1 + i) ** -n) / i - valor
  let baixo = 1e-9
  let alto = 10 // 1000% ao mês
  if (f(alto) > 0) return alto
  for (let k = 0; k < 200; k++) {
    const meio = (baixo + alto) / 2
    if (f(meio) > 0) baixo = meio
    else alto = meio
  }
  return (baixo + alto) / 2
}

/**
 * modo "inicio": a data escolhida é o início do contrato e a 1ª parcela vence um mês depois.
 * modo "parcela": a data escolhida já é o vencimento da 1ª parcela.
 */
export function calcular({ valor, parcela, n, data, modo = 'inicio' }) {
  const v = Number(valor), p = Number(parcela), q = parseInt(n, 10)
  if (!(v > 0) || !(p > 0) || !(q >= 1 && q <= 120) || !dataValida(data)) return null
  const primeira = modo === 'parcela' ? data : somaMeses(data, 1)
  const datas = Array.from({ length: q }, (_, i) => somaMeses(primeira, i))
  const total = arred(p * q)
  const taxa = taxaMensal(v, p, q)
  return {
    valor: v, parcela: p, n: q, modo, inicio: modo === 'inicio' ? data : null,
    total,
    juros: arred(total - v),
    jurosPctTotal: arred(((total - v) / v) * 100),
    taxaMes: taxa === null ? null : arred(taxa * 100, 2),
    primeira, ultima: datas[datas.length - 1], datas,
    semJuros: taxa === null, // true quando as parcelas somam menos que o valor emprestado
  }
}
