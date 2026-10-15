import { proximoDiaUtil, somaMeses, taxaMensal } from '../shared/parcelas.js'
import { criarExigeAnalista, registrar } from './auditoria.js'
import { emTransacao, q } from './db.js'

/**
 * Dados de demonstração. Tudo que é criado aqui tem id começando por "demo-" e "demo: true", então dá para
 * removê-los de uma vez sem encostar nos cadastros reais. Os dados são sempre os mesmos (gerador com semente fixa).
 */
const PREFIXO = 'demo-'

const NOMES = ['Maria', 'José', 'Ana', 'Carlos', 'Fernanda', 'Roberto', 'Patrícia', 'Marcos', 'Juliana', 'Paulo', 'Camila', 'Rafael', 'Luciana', 'Gustavo', 'Aline', 'Diego', 'Beatriz', 'Felipe', 'Larissa', 'Thiago', 'Renata', 'Bruno', 'Priscila', 'Leonardo', 'Mariana', 'André', 'Vanessa', 'Rodrigo', 'Tatiane', 'Eduardo', 'Cláudia', 'Fábio', 'Simone', 'Henrique', 'Débora', 'Wellington', 'Elaine', 'Jefferson', 'Cristiane', 'Anderson']
const SOBRENOMES = ['Silva', 'Souza', 'Oliveira', 'Santos', 'Lima', 'Pereira', 'Costa', 'Rodrigues', 'Almeida', 'Nascimento', 'Ferreira', 'Araújo', 'Gomes', 'Martins', 'Rocha', 'Ribeiro', 'Carvalho', 'Barbosa', 'Dantas', 'Medeiros', 'Nogueira', 'Cavalcanti', 'Teixeira', 'Cardoso', 'Monteiro', 'Freitas', 'Mendes', 'Pinheiro', 'Batista', 'Azevedo']
const BANCOS = ['001 - Banco do Brasil S.A.', '104 - Caixa Econômica Federal', '237 - Banco Bradesco S.A.', '341 - Itaú Unibanco S.A.', '260 - Nu Pagamentos S.A. (Nubank)', '077 - Banco Inter S.A.', '336 - Banco C6 S.A.', '756 - Sicoob']
const LOCAIS = [
  { cidade: 'Natal/RN', cep: '590', peso: 5, ruas: [['Rua Seridó, Petrópolis', -5.7935, -35.2037], ['Av. Hermes da Fonseca, Tirol', -5.8001, -35.2090], ['Rua Prof. Zuza, Capim Macio', -5.8532, -35.2058], ['Av. Salgado Filho, Candelária', -5.8326, -35.2150], ['Av. Eng. Roberto Freire, Ponta Negra', -5.8700, -35.1800], ['Rua Mipibu, Petrópolis', -5.7953, -35.1989]] },
  { cidade: 'Parnamirim/RN', cep: '591', peso: 3, ruas: [['Av. Ayrton Senna, Nova Parnamirim', -5.9157, -35.2628], ['Rua das Palmeiras, Emaús', -5.9021, -35.2511], ['Av. Castor Vieira Régis, Centro', -5.9150, -35.2620]] },
  { cidade: 'Mossoró/RN', cep: '596', peso: 2, ruas: [['Rua Dionísio Filgueira, Centro', -5.1875, -37.3441], ['Av. Rio Branco, Santo Antônio', -5.1940, -37.3480], ['Rua Felipe Camarão, Nova Betânia', -5.1700, -37.3350]] },
  { cidade: 'Macaíba/RN', cep: '592', peso: 1, ruas: [['Rua Cel. Fernandes, Centro', -5.8590, -35.3540]] },
]
const NOTAS = ['Prefere ser contatado à noite', 'Prometeu pagar até o dia 20', 'Atualizou o telefone', 'Indicação de outro cliente', 'Combinou renegociar as parcelas', 'Paga sempre no início do mês', 'Pediu comprovante por e-mail', 'Cliente antigo, bom pagador']

const pad = (n) => String(n).padStart(2, '0')
const arred = (n, c = 2) => Math.round((n + Number.EPSILON) * 10 ** c) / 10 ** c
const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')

function prng(semente) {
  let a = semente >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function cpfFalso(r) {
  const d = Array.from({ length: 9 }, () => Math.floor(r() * 10))
  if (d.every((x) => x === d[0])) d[8] = (d[8] + 1) % 10
  const dv = (arr) => {
    const n = arr.length + 1
    const m = (arr.reduce((s, x, i) => s + x * (n - i), 0) * 10) % 11
    return m === 10 ? 0 : m
  }
  d.push(dv(d)); d.push(dv(d))
  return `${d.slice(0, 3).join('')}.${d.slice(3, 6).join('')}.${d.slice(6, 9).join('')}-${d.slice(9).join('')}`
}

/** PDF mínimo e válido, só com texto em ASCII (documento de exemplo, sem valor). */
function pdfSimples(titulo, linhas) {
  const esc = (s) => semAcento(s).replace(/[\\()]/g, '')
  const conteudo = `BT /F1 20 Tf 56 760 Td (${esc(titulo)}) Tj /F1 12 Tf ${linhas.map((l) => `0 -24 Td (${esc(l)}) Tj`).join(' ')} ET`
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(conteudo)} >>\nstream\n${conteudo}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let pdf = '%PDF-1.4\n'
  const pos = []
  objs.forEach((o, i) => { pos.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${o}\nendobj\n` })
  const xref = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${pos.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(pdf, 'latin1')
}
const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

export function gerarDemo(hojeISO, quantidade = 80) {
  const r = prng(20261015)
  const inteiro = (a, b) => a + Math.floor(r() * (b - a + 1))
  const pick = (l) => l[Math.floor(r() * l.length)]
  const pesos = (lista) => { let x = r() * lista.reduce((s, l) => s + l.peso, 0); for (const l of lista) { x -= l.peso; if (x <= 0) return l } return lista[0] }
  const mesIso = (k) => somaMeses(`${hojeISO.slice(0, 7)}-01`, k).slice(0, 7)
  const diaHoje = Number(hojeISO.slice(8))

  const itens = []
  const docs = []
  const usados = new Set()
  let seqLog = 0
  const novoLog = (debtorId, texto, tipo, data) => itens.push({ colecao: 'logs', id: `${PREFIXO}lg${++seqLog}`, dados: { id: `${PREFIXO}lg${seqLog}`, debtorId, texto, tipo, data, demo: true } })

  const total = quantidade + 4 // 4 extras ficam na lixeira
  for (let i = 0; i < total; i++) {
    const id = `${PREFIXO}c${String(i + 1).padStart(3, '0')}`
    let nome
    do { nome = `${pick(NOMES)} ${pick(SOBRENOMES)} ${pick(SOBRENOMES)}` } while (usados.has(nome))
    usados.add(nome)
    const [primeiroNome, ...resto] = semAcento(nome).toLowerCase().split(' ')
    const local = pesos(LOCAIS)
    const [rua, lat, lng] = pick(local.ruas)
    const valor = pick([500, 800, 1000, 1000, 1200, 1500, 2000, 2000, 2500, 3000, 4000, 5000, 7500, 10000, 15000, 20000])
    const telefone = `(84) 9${inteiro(6, 9)}${inteiro(100, 999)}-${inteiro(1000, 9999)}`
    const cpf = cpfFalso(r)
    const base = {
      id, demo: true, nome, cpf, rg: `${inteiro(1, 3)}.${inteiro(100, 999)}.${inteiro(100, 999)}`,
      email: `${primeiroNome}.${resto[resto.length - 1]}${inteiro(1, 99)}@email.com`, telefone,
      cep: `${local.cep}${inteiro(10, 99)}-${inteiro(100, 999)}`, endereco: rua, numero: String(inteiro(1, 999)), complemento: r() < 0.25 ? pick(['Casa', 'Apto 101', 'Fundos', 'Sala 3']) : '',
      cidade: local.cidade, tipoEndereco: r() < 0.82 ? 'Residencial' : 'Trabalho',
      lat: arred(lat + (r() - 0.5) * 0.02, 5), lng: arred(lng + (r() - 0.5) * 0.02, 5),
      valorEmprestado: valor, viaLink: r() < 0.2, obs: r() < 0.3 ? pick(NOTAS) : '',
    }
    if (r() < 0.85) {
      const tipoPix = pick(['CPF', 'Telefone', 'E-mail', 'Aleatória'])
      Object.assign(base, {
        banco: pick(BANCOS), agencia: String(inteiro(1000, 9999)), conta: `${inteiro(10000, 99999)}-${inteiro(0, 9)}`,
        tipoConta: pick(['Corrente', 'Corrente', 'Poupança']), titularConta: nome, tipoChavePix: tipoPix,
        chavePix: tipoPix === 'CPF' ? cpf : tipoPix === 'Telefone' ? telefone : tipoPix === 'E-mail' ? base.email : `${inteiro(10000000, 99999999).toString(16)}-a0ae-4de7-98ab-${inteiro(100000000000, 999999999999).toString(16)}`,
      })
    }

    const dia = inteiro(1, 28)
    let pagos = []
    let atrasoDias = 0
    if (r() < 0.68) {
      // com parcelamento definido
      const n = pick([6, 8, 10, 12, 12, 15, 18, 24])
      const taxa = pick([0.025, 0.03, 0.035, 0.04, 0.05, 0.06, 0.07, 0.08])
      const parcela = arred((valor * taxa) / (1 - (1 + taxa) ** -n))
      let inicio = inteiro(-8, 2)
      if (inicio + n - 1 < 0) inicio = -inteiro(0, Math.min(8, n - 1))
      const primeiro = `${mesIso(inicio)}-${pad(dia)}`
      const totalPagar = arred(parcela * n)
      Object.assign(base, {
        parcelas: n, valorParcela: parcela, jurosPct: arred((taxaMensal(valor, parcela, n) ?? taxa) * 100), totalAPagar: totalPagar,
        valorJuros: arred(totalPagar - valor), jurosPctTotal: arred(((totalPagar - valor) / valor) * 100),
        primeiroVencimento: primeiro, ultimoVencimento: somaMeses(primeiro, n - 1), dataContrato: `${mesIso(inicio - 1)}-${pad(dia)}`,
        diaVencimento: dia, criadoEm: `${mesIso(inicio - 1)}-${pad(dia)}`,
      })
      const devidos = []
      for (let k = 0; k < n; k++) { const nominal = somaMeses(primeiro, k); if (proximoDiaUtil(nominal) <= hojeISO) devidos.push(nominal.slice(0, 7)) }
      const perfil = r()
      const pular = perfil < 0.5 ? 0 : perfil < 0.78 ? inteiro(1, 2) : perfil < 0.92 ? inteiro(3, 4) : 0
      pagos = devidos.slice(0, Math.max(0, devidos.length - pular))
      if (perfil > 0.94 && devidos.length < n) pagos.push(somaMeses(primeiro, devidos.length).slice(0, 7))
      if (pagos.length >= 4 && r() < 0.1) pagos.splice(inteiro(1, pagos.length - 2), 1) // uma parcela do meio ficou em aberto
      atrasoDias = devidos.length > pagos.filter((m) => devidos.includes(m)).length ? inteiro(2, 40) : 0
    } else {
      // sem parcelamento definido (parcela mensal fixa)
      const parcela = arred(valor * pick([0.15, 0.2, 0.25, 0.3]))
      const ate = dia <= diaHoje && r() < 0.6 ? 0 : -1
      const cnt = inteiro(0, 4)
      pagos = Array.from({ length: cnt }, (_, j) => mesIso(ate - (cnt - 1 - j)))
      Object.assign(base, { valorParcela: parcela, jurosPct: pick([3, 4, 5, 6, 8, 10]), diaVencimento: dia, criadoEm: `${mesIso(-inteiro(1, 6))}-${pad(dia)}` })
      atrasoDias = ate === -1 && dia <= diaHoje ? diaHoje - dia : 0
    }
    base.pagos = pagos
    if (i >= quantidade) base.deletedAt = hojeISO
    itens.push({ colecao: 'debtors', id, dados: base })

    for (const mes of pagos) novoLog(id, `Pagamento de ${mes} registrado`, 'pagamento', `${mes}-${pad(Math.min(dia, 28))}T13:00:00.000Z`)
    if (r() < 0.35) novoLog(id, pick(NOTAS), 'nota', `${somaMeses(hojeISO, -inteiro(0, 1)).slice(0, 8)}${pad(inteiro(1, 28))}T15:00:00.000Z`)
    if (atrasoDias > 0 && r() < 0.6) novoLog(id, `Cobrança enviada por WhatsApp (Atrasado há ${atrasoDias} dia(s))`, 'cobranca', `${hojeISO}T14:00:00.000Z`)

    if (i < 14) {
      const nomeDoc = semAcento(nome)
      docs.push({ id: `${PREFIXO}doc${i + 1}a`, cliente_id: id, nome: 'RG - frente e verso (exemplo).pdf', tipo: 'application/pdf', dados: pdfSimples('DOCUMENTO DE EXEMPLO', [`Cliente: ${nomeDoc}`, `CPF: ${cpf}`, 'Arquivo ficticio para demonstracao do sistema.']) })
      docs.push({ id: `${PREFIXO}doc${i + 1}b`, cliente_id: id, nome: 'Comprovante de residência (exemplo).pdf', tipo: 'application/pdf', dados: pdfSimples('COMPROVANTE DE RESIDENCIA - EXEMPLO', [`Cliente: ${nomeDoc}`, `Endereco: ${semAcento(rua)}, ${base.numero} - ${semAcento(local.cidade)}`, 'Arquivo ficticio para demonstracao do sistema.']) })
      if (i % 3 === 0) docs.push({ id: `${PREFIXO}doc${i + 1}c`, cliente_id: id, nome: 'Foto do documento (exemplo).png', tipo: 'image/png', dados: PNG_1X1 })
    }
  }

  // chaves PIX da empresa: valores claramente falsos para ninguém pagar por engano
  ;[['AH Crédito (DEMONSTRAÇÃO)', '341 - Itaú Unibanco S.A.', 'CHAVE-DEMO-NAO-PAGAR-1'], ['AH Crédito (DEMONSTRAÇÃO)', '260 - Nu Pagamentos S.A. (Nubank)', 'CHAVE-DEMO-NAO-PAGAR-2'], ['AH Crédito (DEMONSTRAÇÃO)', '077 - Banco Inter S.A.', 'CHAVE-DEMO-NAO-PAGAR-3']]
    .forEach(([titular, banco, chave], i) => itens.push({ colecao: 'pix', id: `${PREFIXO}pix${i + 1}`, dados: { id: `${PREFIXO}pix${i + 1}`, titular, banco, chave, demo: true } }))

  // movimentações manuais dos últimos 10 meses
  let seqTx = 0
  const lancar = (mes, dia, tipo, descricao, categoria, pagamento, valorTx) => {
    const data = `${mes}-${pad(dia)}`
    if (data > hojeISO) return
    itens.push({ colecao: 'transactions', id: `${PREFIXO}tx${++seqTx}`, dados: { id: `${PREFIXO}tx${seqTx}`, data, tipo, descricao, categoria, pagamento, valor: valorTx, demo: true } })
  }
  for (let k = -9; k <= 0; k++) {
    const mes = mesIso(k)
    lancar(mes, 5, 'saida', 'Aluguel do escritório', 'Aluguel', 'PIX', 1200)
    lancar(mes, 10, 'saida', 'Internet e telefone', 'Contas', 'Boleto', 180)
    lancar(mes, 12, 'saida', 'Energia elétrica', 'Contas', 'Boleto', inteiro(240, 360))
    lancar(mes, 15, 'saida', 'Honorários do contador', 'Serviços', 'PIX', 450)
    if (r() < 0.6) lancar(mes, 20, 'saida', 'Anúncios e marketing', 'Marketing', 'Cartão', inteiro(300, 800))
    if (r() < 0.4) lancar(mes, 8, 'saida', 'Material de escritório', 'Material', 'Cartão', inteiro(60, 220))
    if (r() < 0.4) lancar(mes, 18, 'saida', 'Combustível', 'Transporte', 'Cartão', inteiro(150, 400))
    if (r() < 0.5) lancar(mes, 9, 'entrada', 'Taxa de cadastro', 'Taxas', 'PIX', inteiro(50, 150))
    if (r() < 0.15) lancar(mes, 22, 'entrada', 'Comissão de parceiro', 'Comissões', 'Transferência', inteiro(200, 900))
  }
  lancar(mesIso(-9), 2, 'entrada', 'Aporte de capital dos sócios', 'Aporte', 'Transferência', 120000)
  lancar(mesIso(-4), 3, 'entrada', 'Aporte de capital dos sócios', 'Aporte', 'Transferência', 80000)

  return { itens, docs }
}

const CONTAGEM_SQL = `SELECT
  count(*) FILTER (WHERE colecao = 'debtors' AND dados->>'deletedAt' IS NULL)::int AS clientes,
  count(*) FILTER (WHERE colecao = 'debtors' AND dados->>'deletedAt' IS NOT NULL)::int AS lixeira,
  count(*) FILTER (WHERE colecao = 'transactions')::int AS movimentacoes,
  count(*) FILTER (WHERE colecao = 'pix')::int AS chavesPix,
  count(*) FILTER (WHERE colecao = 'logs')::int AS historico
  FROM itens WHERE id LIKE 'demo-%'`

async function contagens() {
  const c = (await q(CONTAGEM_SQL)).rows[0]
  const d = (await q("SELECT count(*)::int AS n FROM documentos WHERE id LIKE 'demo-%'")).rows[0].n
  const out = { clientes: c.clientes, lixeira: c.lixeira, movimentacoes: c.movimentacoes, chavesPix: c.chavespix ?? c.chavesPix, historico: c.historico, documentos: d }
  out.existe = out.clientes + out.lixeira + out.movimentacoes + out.chavesPix + out.historico + out.documentos > 0
  return out
}

/** Rotas (somente analista): ver, criar e remover os dados de demonstração. */
export function rotasDemo(app, { exigeLogin, asyncRota, hojeBR }) {
  const exigeAnalista = criarExigeAnalista(exigeLogin)

  app.get('/api/demo', ...exigeAnalista, asyncRota(async (req, res) => res.json(await contagens())))

  app.post('/api/demo/criar', ...exigeAnalista, asyncRota(async (req, res) => {
    const quantidade = Math.min(200, Math.max(1, parseInt(req.body?.quantidade, 10) || 80))
    if ((await contagens()).existe && !req.body?.refazer) {
      return res.status(409).json({ erro: 'Já existem dados de demonstração. Remova-os antes ou escolha refazer.' })
    }
    const { itens, docs } = gerarDemo(hojeBR(), quantidade)
    await emTransacao(async (tx) => {
      await tx("DELETE FROM itens WHERE id LIKE 'demo-%'")
      await tx("DELETE FROM documentos WHERE id LIKE 'demo-%' OR cliente_id LIKE 'demo-%'")
      for (const it of itens) {
        await tx('INSERT INTO itens (colecao, id, dados) VALUES ($1, $2, $3::jsonb)', [it.colecao, it.id, JSON.stringify(it.dados)])
      }
      for (const d of docs) {
        await tx('INSERT INTO documentos (id, cliente_id, nome, tipo, tamanho, dados) VALUES ($1, $2, $3, $4, $5, $6)', [d.id, d.cliente_id, d.nome, d.tipo, d.dados.length, d.dados])
      }
    })
    const c = await contagens()
    await registrar(req, 'demo_criar', { entidade: 'sistema', detalhe: { clientes: c.clientes, lixeira: c.lixeira, movimentacoes: c.movimentacoes, documentos: c.documentos } })
    res.json(c)
  }))

  app.delete('/api/demo', ...exigeAnalista, asyncRota(async (req, res) => {
    const antes = await contagens()
    await emTransacao(async (tx) => {
      await tx("DELETE FROM itens WHERE id LIKE 'demo-%'")
      await tx("DELETE FROM documentos WHERE id LIKE 'demo-%' OR cliente_id LIKE 'demo-%'")
    })
    await registrar(req, 'demo_remover', { entidade: 'sistema', detalhe: { clientes: antes.clientes, lixeira: antes.lixeira, movimentacoes: antes.movimentacoes, documentos: antes.documentos } })
    res.json(await contagens())
  }))
}
