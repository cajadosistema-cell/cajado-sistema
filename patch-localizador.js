/**
 * patch-localizador.js
 * Adiciona mensagem de localizador após cada ação salva com sucesso
 * Ex: "✅ Salvo em: Gastos Pessoais > Alimentação (01/06)"
 */
const fs = require('fs')
const path = require('path')

const filePath = path.join(__dirname, 'components', 'shared', 'SecretariaFlutuante.tsx')
let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n')

// Helper de localização — inserido antes do handleAcao
const helperLocalizador = `
  // ── Localizador: exibe onde foi salvo ───────────────────────────
  const exibirLocalizador = (tipo: string, dados: Record<string, any>, dataStr?: string) => {
    const mapas: Record<string, string> = {
      gasto:             'Gastos Pessoais',
      receita:           'Receitas Pessoais',
      gasto_empresa:     'Despesas da Empresa',
      receita_empresa:   'Receitas da Empresa',
      agenda:            'Agenda',
      ocorrencia:        'Ocorrências',
      ideia:             'Ideias',
      transferencia:     'Transferências',
      definir_meta:      'Metas Financeiras',
      registro_livre:    'Memória da Elena',
      importar_extrato:  'Gastos (Extrato)',
      fatura_cartao:     'Cartões PF > Faturas',
      parcela_imovel:    'Patrimônio > Imóveis',
    }
    const local = mapas[tipo] || tipo
    const cat = dados.categoria ? \` > \${dados.categoria}\` : ''
    const conta = dados.conta_nome ? \` [\${dados.conta_nome}]\` : ''
    const titulo = dados.titulo ? \` "\${dados.titulo.substring(0, 30)}"\` : ''
    const data = dataStr || dados.data || new Date().toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' })
    const valor = dados.valor ? \` — R\$ \${Number(dados.valor).toFixed(2)}\` : ''
    const info = \`📍 Salvo em: **\${local}\${cat}\${conta}\${titulo}** (\${data})\${valor}\`
    setMensagens(prev => [...prev, {
      id: Date.now().toString() + '_loc',
      role: 'ai',
      texto: info,
    }])
  }
\n`

// Insere helper antes do handleAcao
const anchorHandleAcao = `  const handleAcao = async (`
if (!content.includes(anchorHandleAcao)) {
  console.error('Anchor handleAcao não encontrado')
  process.exit(1)
}
content = content.replace(anchorHandleAcao, helperLocalizador + anchorHandleAcao)
console.log('✅ Helper localizador inserido')

// Adiciona chamada ao localizador após cada ação de gasto salvo
const oldGastoSaved = `        if (novoGasto?.id) ultimoRegistroRef.current = { tabela: 'gastos_pessoais', id: novoGasto.id }
        setAcaoStatus(msgId, acaoIdx, 'saved')
        window.dispatchEvent(new CustomEvent('elena:lancamento-salvo'))`

const newGastoSaved = `        if (novoGasto?.id) ultimoRegistroRef.current = { tabela: 'gastos_pessoais', id: novoGasto.id }
        setAcaoStatus(msgId, acaoIdx, 'saved')
        exibirLocalizador('gasto', acao.dados)
        window.dispatchEvent(new CustomEvent('elena:lancamento-salvo'))`

if (!content.includes(oldGastoSaved)) {
  console.error('Anchor gasto saved não encontrado')
} else {
  content = content.replace(oldGastoSaved, newGastoSaved)
  console.log('✅ Localizador em gastos pessoais')
}

// Agenda
const oldAgendaSaved = `        setAcaoStatus(msgId, acaoIdx, 'saved')
        window.dispatchEvent(new CustomEvent('elena:agenda-salva'))`

const newAgendaSaved = `        setAcaoStatus(msgId, acaoIdx, 'saved')
        exibirLocalizador('agenda', acao.dados, acao.dados.data_inicio ? new Date(acao.dados.data_inicio).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }) : undefined)
        window.dispatchEvent(new CustomEvent('elena:agenda-salva'))`

if (content.includes(oldAgendaSaved)) {
  content = content.replace(oldAgendaSaved, newAgendaSaved)
  console.log('✅ Localizador em agenda')
} else {
  console.log('⚠️ Anchor agenda não encontrado (talvez evento diferente)')
}

fs.writeFileSync(filePath, content, 'utf8')
console.log('\n✅ Patch localizador aplicado!')
console.log('Tamanho:', content.length)
