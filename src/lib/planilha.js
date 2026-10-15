import * as XLSX from 'xlsx'
import { hojeISO, moedaCampo, parseMoeda, soDigitos, formataCep, statusDe } from './utils'

/** Colunas da planilha, na ordem do modelo. O mesmo formato serve para exportar e importar. */
export const COLUNAS = [
  { chave: 'nome', titulo: 'Nome *', exemplo: 'EXEMPLO - Maria da Silva (apague esta linha)', largura: 34 },
  { chave: 'telefone', titulo: 'Telefone / WhatsApp', exemplo: '(84) 99999-0000', largura: 20 },
  { chave: 'cpf', titulo: 'CPF', exemplo: '000.000.000-00', largura: 16 },
  { chave: 'rg', titulo: 'RG', exemplo: '1234567', largura: 14 },
  { chave: 'email', titulo: 'E-mail', exemplo: 'maria@email.com', largura: 26 },
  { chave: 'cep', titulo: 'CEP', exemplo: '59600-000', largura: 12 },
  { chave: 'endereco', titulo: 'Endereço (rua e bairro)', exemplo: 'Rua das Flores, Centro', largura: 34 },
  { chave: 'numero', titulo: 'Número', exemplo: '100', largura: 9 },
  { chave: 'complemento', titulo: 'Complemento', exemplo: 'Casa', largura: 16 },
  { chave: 'cidade', titulo: 'Cidade/UF', exemplo: 'Mossoró/RN', largura: 18 },
  { chave: 'tipoEndereco', titulo: 'Tipo de endereço', exemplo: 'Residencial', largura: 16 },
  { chave: 'valorEmprestado', titulo: 'Valor emprestado (R$)', exemplo: '1.000,00', largura: 20 },
  { chave: 'valorParcela', titulo: 'Valor da parcela mensal (R$)', exemplo: '200,00', largura: 26 },
  { chave: 'jurosPct', titulo: 'Juros (% ao mês)', exemplo: '20', largura: 16 },
  { chave: 'diaVencimento', titulo: 'Dia de vencimento *', exemplo: '10', largura: 18 },
  { chave: 'banco', titulo: 'Banco', exemplo: '341 - Itaú Unibanco S.A.', largura: 28 },
  { chave: 'agencia', titulo: 'Agência', exemplo: '1234', largura: 10 },
  { chave: 'conta', titulo: 'Conta (com dígito)', exemplo: '12345-6', largura: 18 },
  { chave: 'tipoConta', titulo: 'Tipo de conta', exemplo: 'Corrente', largura: 14 },
  { chave: 'titularConta', titulo: 'Titular da conta', exemplo: 'Maria da Silva', largura: 24 },
  { chave: 'tipoChavePix', titulo: 'Tipo da chave PIX', exemplo: 'Telefone', largura: 16 },
  { chave: 'chavePix', titulo: 'Chave PIX do cliente', exemplo: '84999990000', largura: 22 },
  { chave: 'obs', titulo: 'Observações', exemplo: '', largura: 30 },
]

const INSTRUCOES = [
  ['Como preencher a planilha de clientes — AH Crédito'],
  [''],
  ['1. Preencha uma linha por cliente na aba "Clientes", a partir da linha 2.'],
  ['2. Campos obrigatórios: "Nome" e "Dia de vencimento" (número de 1 a 31).'],
  ['3. Valores em reais podem ser digitados como 1.000,00 ou 1000. Juros é só o número (20 = 20% ao mês).'],
  ['4. "Tipo de endereço": Residencial ou Trabalho.'],
  ['5. Apague a linha de exemplo antes de importar (linhas que começam com "EXEMPLO" são ignoradas).'],
  ['6. Não altere os títulos das colunas nem a ordem.'],
  ['7. No sistema: Empréstimos > Importar Cadastro > Planilha, escolha este arquivo e confirme.'],
  ['8. Clientes que já existem (mesmo CPF, ou mesmo nome e telefone) são ignorados para não duplicar.'],
]

const salvar = (wb, nome) => XLSX.writeFile(wb, nome)

function montarAba(linhas) {
  const ws = XLSX.utils.aoa_to_sheet([COLUNAS.map((c) => c.titulo), ...linhas])
  ws['!cols'] = COLUNAS.map((c) => ({ wch: c.largura }))
  ws['!freeze'] = { xSplit: 0, ySplit: 1 }
  return ws
}

export function baixarModelo() {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, montarAba([COLUNAS.map((c) => c.exemplo)]), 'Clientes')
  const ws2 = XLSX.utils.aoa_to_sheet(INSTRUCOES)
  ws2['!cols'] = [{ wch: 100 }]
  XLSX.utils.book_append_sheet(wb, ws2, 'Instruções')
  salvar(wb, 'modelo-clientes-ah-credito.xlsx')
}

/** Exporta os clientes cadastrados no mesmo formato do modelo (pode ser reimportado em outro navegador). */
export function exportarClientes(debtors) {
  const wb = XLSX.utils.book_new()
  const linhas = debtors.map((d) => COLUNAS.map((c) => {
    if (c.chave === 'valorEmprestado' || c.chave === 'valorParcela') return moedaCampo(d[c.chave])
    return d[c.chave] ?? ''
  }))
  XLSX.utils.book_append_sheet(wb, montarAba(linhas), 'Clientes')
  const ws2 = XLSX.utils.aoa_to_sheet([['Situação em ' + hojeISO().split('-').reverse().join('/')], ...debtors.map((d) => [d.nome, statusDe(d)])])
  XLSX.utils.book_append_sheet(wb, ws2, 'Situação')
  salvar(wb, `clientes-ah-credito-${hojeISO()}.xlsx`)
}

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/ +/g, ' ').trim()

function chaveDoTitulo(titulo) {
  const t = norm(titulo)
  if (!t) return null
  if (t.startsWith('nome')) return 'nome'
  if (t.includes('telefone') || t.includes('whatsapp')) return 'telefone'
  if (t === 'cpf') return 'cpf'
  if (t === 'rg') return 'rg'
  if (t.includes('mail')) return 'email'
  if (t === 'cep') return 'cep'
  if (t.includes('tipo') && t.includes('endereco')) return 'tipoEndereco'
  if (t.startsWith('endereco')) return 'endereco'
  if (t.startsWith('numero')) return 'numero'
  if (t.startsWith('complemento')) return 'complemento'
  if (t.startsWith('cidade')) return 'cidade'
  if (t.includes('emprestado')) return 'valorEmprestado'
  if (t.includes('parcela')) return 'valorParcela'
  if (t.includes('juros')) return 'jurosPct'
  if (t.includes('vencimento')) return 'diaVencimento'
  if (t.startsWith('banco')) return 'banco'
  if (t.includes('agencia')) return 'agencia'
  if (t.includes('titular')) return 'titularConta'
  if (t.includes('tipo') && t.includes('conta')) return 'tipoConta'
  if (t.startsWith('conta')) return 'conta'
  if (t.includes('tipo') && t.includes('pix')) return 'tipoChavePix'
  if (t.includes('pix')) return 'chavePix'
  if (t.includes('observ')) return 'obs'
  return null
}

const texto = (v) => String(v ?? '').trim()
const dinheiro = (v) => (typeof v === 'number' ? v : parseMoeda(v))
const percentual = (v) => (typeof v === 'number' ? v : parseFloat(String(v).replace('%', '').replace(',', '.')) || 0)

/** Lê a planilha (xlsx, xls ou csv) e devolve as linhas já validadas. */
export async function lerPlanilha(arquivo, existentes = []) {
  const wb = XLSX.read(await arquivo.arrayBuffer(), { type: 'array' })
  const nomeAba = wb.SheetNames.find((n) => norm(n) === 'clientes') || wb.SheetNames[0]
  const matriz = XLSX.utils.sheet_to_json(wb.Sheets[nomeAba], { header: 1, defval: '', raw: true })
  if (!matriz.length) return { linhas: [], colunasFaltando: ['Nome', 'Dia de vencimento'] }

  const mapa = matriz[0].map(chaveDoTitulo)
  const faltando = ['nome', 'diaVencimento'].filter((k) => !mapa.includes(k))
  if (faltando.length) return { linhas: [], colunasFaltando: faltando.map((k) => COLUNAS.find((c) => c.chave === k).titulo) }

  const jaTem = (d) => existentes.some((e) =>
    (soDigitos(d.cpf) && soDigitos(d.cpf) === soDigitos(e.cpf)) ||
    (norm(d.nome) === norm(e.nome) && soDigitos(d.telefone) === soDigitos(e.telefone)))

  const vistos = []
  const linhas = []
  matriz.slice(1).forEach((linha, i) => {
    const bruto = {}
    mapa.forEach((k, col) => { if (k) bruto[k] = linha[col] })
    const nome = texto(bruto.nome)
    if (!nome && !Object.values(bruto).some((v) => texto(v))) return // linha vazia
    if (norm(nome).startsWith('exemplo')) return

    const dia = parseInt(texto(bruto.diaVencimento), 10)
    const cliente = {
      nome,
      telefone: texto(bruto.telefone), cpf: texto(bruto.cpf), rg: texto(bruto.rg), email: texto(bruto.email),
      cep: soDigitos(bruto.cep).length === 8 ? formataCep(bruto.cep) : texto(bruto.cep),
      endereco: texto(bruto.endereco), numero: texto(bruto.numero), complemento: texto(bruto.complemento), cidade: texto(bruto.cidade),
      tipoEndereco: /trab/i.test(texto(bruto.tipoEndereco)) ? 'Trabalho' : 'Residencial',
      valorEmprestado: dinheiro(bruto.valorEmprestado ?? 0), valorParcela: dinheiro(bruto.valorParcela ?? 0),
      jurosPct: percentual(bruto.jurosPct ?? 0), diaVencimento: dia, chavePix: texto(bruto.chavePix), obs: texto(bruto.obs),
      banco: texto(bruto.banco), agencia: texto(bruto.agencia), conta: texto(bruto.conta), titularConta: texto(bruto.titularConta),
      tipoConta: /poup/i.test(texto(bruto.tipoConta)) ? 'Poupança' : /pag/i.test(texto(bruto.tipoConta)) ? 'Pagamento' : 'Corrente',
      tipoChavePix: ['CPF', 'CNPJ', 'Telefone', 'E-mail', 'Aleatória'].find((t) => t.toLowerCase() === texto(bruto.tipoChavePix).toLowerCase()) || 'CPF',
    }
    let situacao = 'ok'
    let motivo = ''
    if (!nome) { situacao = 'erro'; motivo = 'Nome em branco' }
    else if (!(dia >= 1 && dia <= 31)) { situacao = 'erro'; motivo = 'Dia de vencimento inválido (use 1 a 31)' }
    else if (jaTem(cliente)) { situacao = 'duplicado'; motivo = 'Já cadastrado no sistema' }
    else if (vistos.some((v) => (soDigitos(v.cpf) && soDigitos(v.cpf) === soDigitos(cliente.cpf)) || (norm(v.nome) === norm(cliente.nome) && soDigitos(v.telefone) === soDigitos(cliente.telefone)))) {
      situacao = 'duplicado'; motivo = 'Repetido na própria planilha'
    }
    if (situacao === 'ok') vistos.push(cliente)
    linhas.push({ linha: i + 2, cliente, situacao, motivo })
  })
  return { linhas, colunasFaltando: [] }
}
