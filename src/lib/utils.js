import { useEffect, useState } from 'react'

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
export const brl = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const p2 = (n) => String(n).padStart(2, '0')
export const hojeISO = (d = new Date()) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
export const mesAtual = (d = new Date()) => hojeISO(d).slice(0, 7)
export const fmtData = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '')
export const soDigitos = (s) => String(s || '').replace(/\D/g, '')

export function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* armazenamento indisponível */
    }
  }, [key, value])
  return [value, setValue]
}

/** Status do cliente no mês corrente: pago | atrasado | a_cobrar */
export function statusDe(d, ref = new Date()) {
  if (d.statusOverride) return d.statusOverride
  const mes = mesAtual(ref)
  if ((d.pagos || []).includes(mes)) return 'pago'
  return ref.getDate() > Number(d.diaVencimento || 1) ? 'atrasado' : 'a_cobrar'
}

export const STATUS_LABEL = { pago: 'PAGO', atrasado: 'ATRASADO', a_cobrar: 'A COBRAR' }

export function whatsLink(tel, msg) {
  const n = soDigitos(tel)
  const full = n.length <= 11 ? '55' + n : n
  return `https://wa.me/${full}?text=${encodeURIComponent(msg)}`
}

export const formataCep = (v) => {
  const d = soDigitos(v).slice(0, 8)
  return d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d
}

const comTimeout = (url, ms = 6000, opts) => {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  return fetch(url, { ...opts, signal: c.signal }).finally(() => clearTimeout(t))
}

/** Busca o endereço pelo CEP na BrasilAPI (v2, traz coordenadas), com ViaCEP como reserva. Retorna null se não achar. */
export async function buscaCep(cep) {
  const c = soDigitos(cep)
  if (c.length !== 8) return null
  try {
    const r = await (await comTimeout(`https://brasilapi.com.br/api/cep/v2/${c}`)).json()
    if (r.city) {
      const co = r.location?.coordinates
      return {
        endereco: [r.street, r.neighborhood].filter(Boolean).join(', '),
        cidade: `${r.city}/${r.state}`,
        cidadeNome: r.city, uf: r.state, bairro: r.neighborhood, logradouro: r.street,
        lat: co?.latitude ? +co.latitude : undefined, lng: co?.longitude ? +co.longitude : undefined,
      }
    }
  } catch { /* tenta a reserva */ }
  try {
    const r = await (await comTimeout(`https://viacep.com.br/ws/${c}/json/`)).json()
    if (!r.erro) {
      return {
        endereco: [r.logradouro, r.bairro].filter(Boolean).join(', '),
        cidade: `${r.localidade}/${r.uf}`,
        cidadeNome: r.localidade, uf: r.uf, bairro: r.bairro, logradouro: r.logradouro,
      }
    }
  } catch { /* sem resultado */ }
  return null
}

export async function geocode(q) {
  try {
    const r = await (await comTimeout(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=br`, 8000, { headers: { 'Accept-Language': 'pt-BR' } })).json()
    return r.length ? { lat: parseFloat(r[0].lat), lng: parseFloat(r[0].lon) } : null
  } catch {
    return null
  }
}

/** Localiza o endereço do cliente: rua+número, depois coordenadas do CEP, depois a cidade. */
export async function localizarCliente(d) {
  const cidade = d.cidade || ''
  const rua = [d.endereco, d.numero].filter(Boolean).join(' ')
  let g = rua ? await geocode(`${rua}, ${cidade}, Brasil`) : null
  if (g) return g
  const cep = await buscaCep(d.cep)
  if (cep?.lat) return { lat: cep.lat, lng: cep.lng }
  g = await geocode(`${soDigitos(d.cep)}, Brasil`)
  if (g) return g
  return cidade ? await geocode(`${cidade}, Brasil`) : null
}

export function baixarArquivo(nome, conteudo, tipo = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob(['﻿' + conteudo], { type: tipo }))
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  URL.revokeObjectURL(url)
}

/** Moeda digitada: 1000 -> "1.000"; com vírgula mantém até 2 casas ("1.000,5"). */
export function mascaraMoeda(texto) {
  const t = String(texto).replace(/[^\d,]/g, '')
  const i = t.indexOf(',')
  const inteiro = (i < 0 ? t : t.slice(0, i)).replace(/^0+(?=\d)/, '')
  const milhar = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  if (i < 0) return milhar
  return (milhar || '0') + ',' + t.slice(i + 1).replace(/,/g, '').slice(0, 2)
}
/** Valor final com duas casas: "1.000" -> "1.000,00". */
export function completaMoeda(texto) {
  const m = mascaraMoeda(texto)
  if (!m) return ''
  const [int, dec = ''] = m.split(',')
  return int + ',' + dec.padEnd(2, '0')
}
export const parseMoeda = (texto) => parseFloat(String(texto).replace(/\./g, '').replace(',', '.')) || 0
/** Número -> texto do campo ("1500" -> "1.500,00"). */
export const moedaCampo = (n) => (n || n === 0 ? completaMoeda(String(Number(n).toFixed(2)).replace('.', ',')) : '')

const BANCOS_BASE = [
  '001 - Banco do Brasil S.A.', '033 - Banco Santander (Brasil) S.A.', '104 - Caixa Econômica Federal',
  '237 - Banco Bradesco S.A.', '260 - Nu Pagamentos S.A. (Nubank)', '077 - Banco Inter S.A.', '341 - Itaú Unibanco S.A.',
  '336 - Banco C6 S.A.', '323 - Mercado Pago', '197 - Stone Pagamentos S.A.', '380 - PicPay', '756 - Sicoob', '748 - Sicredi',
]

/** Lista de bancos da BrasilAPI ("001 - Banco do Brasil S.A."), guardada no navegador; usa lista básica se estiver sem internet. */
export function useBancos() {
  const [bancos, setBancos] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ahc:bancos') || 'null') || BANCOS_BASE } catch { return BANCOS_BASE }
  })
  useEffect(() => {
    let vivo = true
    comTimeout('https://brasilapi.com.br/api/banks/v1', 10000)
      .then((r) => r.json())
      .then((l) => {
        const lista = l
          .filter((b) => b.code != null)
          .map((b) => `${String(b.code).padStart(3, '0')} - ${b.fullName || b.name}`)
          .sort((a, b) => a.localeCompare(b))
        if (!vivo || !lista.length) return
        setBancos(lista)
        try { localStorage.setItem('ahc:bancos', JSON.stringify(lista)) } catch { /* sem armazenamento */ }
      })
      .catch(() => {})
    return () => { vivo = false }
  }, [])
  return bancos
}
