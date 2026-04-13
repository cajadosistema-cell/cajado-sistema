/**
 * SEED DE DADOS FICTÍCIOS — Sistema Cajado
 * Empresa: Cajado Soluções (licenciamento, CRLV, regularização veicular)
 *
 * Execute: node scripts/seed-demo.js
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL  = 'https://wagkyyqstsgetktefewd.supabase.co'
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZ2t5eXFzdHNnZXRrdGVmZXdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5NzIxNTAsImV4cCI6MjA5MTU0ODE1MH0.8DOD4XOrOZD21bl-J6WN8a1nk3cTJJm8Ope_s9V7Hnk'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─── HELPERS ────────────────────────────────────────────────────────────────

function diasAtras(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

function mesAtras(n) {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  return d.toISOString().split('T')[0]
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ─── DADOS ──────────────────────────────────────────────────────────────────

const NOMES = [
  'Ana Paula Ferreira','Carlos Eduardo Silva','Marcos Antônio Lima','Juliana Costa Rocha',
  'Rafael Souza Nunes','Fernanda Oliveira','João Batista Carvalho','Mariana Alves Santos',
  'Pedro Henrique Melo','Tatiane Ribeiro Cruz','Lucas Vieira Campos','Camila Barbosa Torres',
  'Diego Nascimento Faria','Larissa Cunha Pinto','Rodrigo Mendonça Leal','Aline Pires Barros',
  'Felipe Azevedo Gomes','Patrícia Teixeira Luz','Bruno Martins Freitas','Vanessa Lima Costa',
]

const SERVICOS = [
  'Licenciamento Anual', 'Transferência de Propriedade', 'CRLV Digital',
  'Regularização de Débitos', 'Vistoria Veicular', 'Placa Mercosul',
  'Seguro DPVAT', 'Multas e Infrações', 'Primeira Habilitação',
  'Renovação CNH', 'Adição de Categoria', 'Laudo Cautelar',
]

const PLACAS = [
  'BRA-2E19','ABC-1234','DEF-5678','GHI-9012','JKL-3456',
  'MNO-7890','PQR-2345','STU-6789','VWX-0123','YZA-4567',
]

const FONES = [
  '(77) 98812-3456','(77) 99912-7890','(77) 98745-2341','(77) 99623-8901',
  '(77) 98534-5678','(77) 99401-2345','(77) 98312-6789','(77) 99234-0123',
  '(77) 98198-4567','(77) 99087-8901','(72) 99912-3456','(74) 98812-7890',
]

const EMAILS = [
  'cliente@gmail.com','usuario@hotmail.com','contato@outlook.com',
  'vendas@empresa.com.br','suporte@negocio.net',
]

// ─── SEED FUNCTIONS ─────────────────────────────────────────────────────────

async function seedTimes() {
  console.log('\n⏳ Seeding TIMES...')
  const times = [
    { nome: 'Licenciamento', descricao: 'Licenciamento anual e CRLV', palavras_chave: 'licenciamento,crlv,placa,anual', cor: '#3b82f6', emoji: '🚗', ativo: true },
    { nome: 'Transferência', descricao: 'Transferência de propriedade', palavras_chave: 'transferência,compra,venda,proprietário', cor: '#8b5cf6', emoji: '📋', ativo: true },
    { nome: 'Regularização', descricao: 'Débitos, multas e regularização', palavras_chave: 'débito,multa,regularizar,DETRAN', cor: '#ef4444', emoji: '⚠️', ativo: true },
    { nome: 'Habilitação', descricao: 'CNH e categorias', palavras_chave: 'CNH,habilitação,categoria,renovação', cor: '#10b981', emoji: '🪪', ativo: true },
  ]
  const { error } = await supabase.from('times').insert(times)
  if (error) console.log('  Times (já existem ou erro):', error.message)
  else console.log('  ✅ Times inseridos:', times.length)
}

async function seedClientes() {
  console.log('\n⏳ Seeding CLIENTES...')
  const clientes = NOMES.map((nome, i) => ({
    nome,
    telefone: FONES[i % FONES.length],
    email: `${nome.split(' ')[0].toLowerCase()}@${pick(['gmail.com','hotmail.com','outlook.com'])}`,
    cpf_cnpj: `${rand(100,999)}.${rand(100,999)}.${rand(100,999)}-${rand(10,99)}`,
    cidade: pick(['Cajado','Barreiras','Luís Eduardo Magalhães','Vitória da Conquista','Bom Jesus da Lapa']),
    estado: 'BA',
    ativo: true,
    criado_em: diasAtras(rand(0, 90)),
  }))
  const { error } = await supabase.from('clientes').insert(clientes)
  if (error) console.log('  Clientes erro:', error.message)
  else console.log('  ✅ Clientes inseridos:', clientes.length)
}

async function seedLeads() {
  console.log('\n⏳ Seeding LEADS (CRM)...')
  const statusFunil = [
    { s: 'novo',        count: 6 },
    { s: 'contato',     count: 5 },
    { s: 'proposta',    count: 4 },
    { s: 'negociacao',  count: 3 },
    { s: 'fechado',     count: 5 },
    { s: 'perdido',     count: 2 },
  ]

  const leads = []
  let nomeIdx = 0

  for (const { s, count } of statusFunil) {
    for (let i = 0; i < count; i++) {
      const nome = NOMES[nomeIdx % NOMES.length]
      const servico = pick(SERVICOS)
      const valor = pick([189, 249, 319, 389, 489, 589, 789, 989])
      leads.push({
        nome,
        telefone: FONES[nomeIdx % FONES.length],
        email: `${nome.split(' ')[0].toLowerCase()}@gmail.com`,
        servico,
        placa: pick(PLACAS),
        valor_estimado: valor,
        status: s,
        origem: pick(['WhatsApp','Indicação','Instagram','Facebook','Google']),
        observacoes: pick([
          `Cliente precisa do ${servico} com urgência`,
          `Veículo com débitos pendentes`,
          `Aguardando documentação`,
          `Em análise no DETRAN`,
          `Retornar em ${rand(2,10)} dias`,
          null,
        ]),
        data_followup: rand(0,1) ? diasAtras(-rand(1, 14)) : null,
        criado_em: diasAtras(rand(1, 60)),
      })
      nomeIdx++
    }
  }

  const { error } = await supabase.from('leads').insert(leads)
  if (error) console.log('  Leads erro:', error.message)
  else console.log('  ✅ Leads inseridos:', leads.length)

  return leads
}

async function seedAtividades(leads) {
  console.log('\n⏳ Seeding ATIVIDADES...')
  const { data: leadsDB } = await supabase.from('leads').select('id,nome').limit(25)
  if (!leadsDB?.length) { console.log('  Sem leads para atividades'); return }

  const tipos = ['ligacao','email','reuniao','whatsapp','visita','outros']
  const atividadeTextos = {
    ligacao:   ['Ligação realizada, cliente interessado', 'Não atendeu, tentar novamente', 'Ligação feita, aguardando retorno'],
    email:     ['E-mail enviado com proposta', 'E-mail de follow-up enviado', 'Confirmação por e-mail recebida'],
    whatsapp:  ['Mensagem enviada pelo WhatsApp', 'Cliente respondeu e pediu mais detalhes', 'Enviados documentos pelo WhatsApp'],
    reuniao:   ['Reunião realizada, apresentação do serviço', 'Reunião agendada para próxima semana'],
    visita:    ['Visita ao cliente realizada', 'Cliente virá ao escritório'],
    outros:    ['Protocolo no DETRAN aberto', 'Documentação recebida e conferida', 'Aguardando liberação do sistema'],
  }

  const atividades = []
  for (const lead of leadsDB) {
    const numAtiv = rand(1, 4)
    for (let i = 0; i < numAtiv; i++) {
      const tipo = pick(tipos)
      atividades.push({
        lead_id: lead.id,
        tipo,
        descricao: pick(atividadeTextos[tipo]),
        data: diasAtras(rand(0, 30)),
        criado_em: diasAtras(rand(0, 30)),
      })
    }
  }

  const { error } = await supabase.from('atividades').insert(atividades)
  if (error) console.log('  Atividades erro:', error.message)
  else console.log('  ✅ Atividades inseridas:', atividades.length)
}

async function seedContas() {
  console.log('\n⏳ Seeding CONTAS FINANCEIRAS...')
  const contas = [
    { nome: 'Bradesco PJ', tipo: 'corrente', categoria: 'pj', saldo_inicial: 18500.00, saldo_atual: 18500.00, ativo: true, cor: '#ef4444' },
    { nome: 'C6 Bank PJ',  tipo: 'corrente', categoria: 'pj', saldo_inicial:  8200.00, saldo_atual:  8200.00, ativo: true, cor: '#1f2937' },
    { nome: 'Caixa Físico', tipo: 'dinheiro', categoria: 'pj', saldo_inicial:  1200.00, saldo_atual:  1200.00, ativo: true, cor: '#10b981' },
    { nome: 'XP Investimentos', tipo: 'investimento', categoria: 'pj', saldo_inicial: 25000.00, saldo_atual: 25000.00, ativo: true, cor: '#f59e0b' },
  ]
  const { error } = await supabase.from('contas').insert(contas)
  if (error) console.log('  Contas erro:', error.message)
  else console.log('  ✅ Contas inseridas:', contas.length)

  const { data: contasDB } = await supabase.from('contas').select('id,nome').limit(10)
  return contasDB || []
}

async function seedLancamentos(contas) {
  console.log('\n⏳ Seeding LANÇAMENTOS FINANCEIROS...')
  if (!contas.length) { console.log('  Sem contas'); return }

  const bradesco = contas.find(c => c.nome.includes('Bradesco')) || contas[0]
  const c6       = contas.find(c => c.nome.includes('C6'))       || contas[0]
  const caixa    = contas.find(c => c.nome.includes('Caixa'))    || contas[0]

  const lancamentos = []

  // Receitas dos últimos 3 meses
  const receitas = [
    'Licenciamento - João Silva', 'CRLV Digital - Maria Souza', 'Transferência - Carlos Lima',
    'Regularização débitos - Ana Ferreira', 'Vistoria veicular - Pedro Costa',
    'Licenciamento - Marcos Oliveira', 'Renovação CNH - Fernanda Rocha',
    'Placa Mercosul - Rafael Santos', 'Multas - Diego Carvalho', 'Licenciamento - Juliana Torres',
    'Primeira habilitação - Lucas Alves', 'Transferência - Camila Pinto',
    'CRLV Digital - Bruno Freitas', 'Laudo cautelar - Larissa Cunha',
    'Seguro DPVAT - Patrícia Teixeira', 'Licenciamento - Felipe Mendonça',
  ]

  for (let mes = 3; mes >= 0; mes--) {
    const numReceitas = rand(10, 18)
    for (let i = 0; i < numReceitas; i++) {
      const valor = pick([189, 249, 319, 389, 489, 589, 789])
      lancamentos.push({
        descricao: pick(receitas),
        valor,
        tipo: 'receita',
        regime: 'caixa',
        status: mes > 0 ? 'validado' : 'automatico',
        data_competencia: mesAtras(mes).replace(/\d{2}$/, String(rand(1,28)).padStart(2,'0')),
        data_caixa: mesAtras(mes).replace(/\d{2}$/, String(rand(1,28)).padStart(2,'0')),
        conciliado: mes > 0,
        conta_id: pick([bradesco.id, c6.id, caixa.id]),
      })
    }
  }

  // Despesas fixas mensais
  const despesas = [
    { desc: 'Aluguel escritório', valor: 1800, fixo: true },
    { desc: 'Internet e telefone', valor: 280, fixo: true },
    { desc: 'Energia elétrica', valor: 320, fixo: true },
    { desc: 'Sistema Cajado (licença)', valor: 197, fixo: true },
    { desc: 'Contador', valor: 450, fixo: true },
    { desc: 'Material de escritório', valor: 85, fixo: false },
    { desc: 'Manutenção impressora', valor: 120, fixo: false },
    { desc: 'Combustível/deslocamento', valor: 380, fixo: false },
    { desc: 'Publicidade Instagram/Google', valor: 500, fixo: false },
    { desc: 'Taxa DETRAN (repasse)', valor: 1200, fixo: false },
    { desc: 'Salário funcionário', valor: 1800, fixo: true },
    { desc: 'INSS/encargos', valor: 540, fixo: true },
  ]

  for (let mes = 3; mes >= 0; mes--) {
    for (const desp of despesas) {
      if (desp.fixo || rand(0, 1)) {
        const variacao = desp.fixo ? 0 : rand(-50, 50)
        lancamentos.push({
          descricao: desp.desc,
          valor: desp.valor + variacao,
          tipo: 'despesa',
          regime: 'caixa',
          status: mes > 0 ? 'validado' : 'pendente',
          data_competencia: mesAtras(mes).replace(/\d{2}$/, String(rand(1,28)).padStart(2,'0')),
          data_caixa: mesAtras(mes).replace(/\d{2}$/, String(rand(1,28)).padStart(2,'0')),
          conciliado: mes > 0,
          conta_id: pick([bradesco.id, c6.id]),
        })
      }
    }
  }

  const { error } = await supabase.from('lancamentos').insert(lancamentos)
  if (error) console.log('  Lançamentos erro:', error.message)
  else console.log('  ✅ Lançamentos inseridos:', lancamentos.length)
}

async function seedVendas() {
  console.log('\n⏳ Seeding VENDAS...')
  const { data: clientes } = await supabase.from('clientes').select('id,nome').limit(20)
  if (!clientes?.length) { console.log('  Sem clientes para vendas'); return }

  const statusVendas = ['orcamento','aprovado','em_andamento','concluido','cancelado']
  const vendas = []

  for (let i = 0; i < 30; i++) {
    const cliente = pick(clientes)
    const servico = pick(SERVICOS)
    const valor   = pick([189, 249, 319, 389, 489, 589, 789, 989])
    const status  = i < 5 ? 'concluido' : i < 12 ? 'em_andamento' : i < 18 ? 'aprovado' : i < 22 ? 'orcamento' : pick(statusVendas)

    vendas.push({
      cliente_id: cliente.id,
      servico,
      placa: pick(PLACAS),
      valor,
      status,
      observacoes: pick([
        `Documentação completa — aguardando DETRAN`,
        `Cliente entregou os documentos em mãos`,
        `Processo ${rand(100000, 999999)} aberto no sistema`,
        `Pagamento confirmado via PIX`,
        `Serviço agendado para visita`,
        null,
      ]),
      created_at: diasAtras(rand(1, 90)),
    })
  }

  const { error } = await supabase.from('vendas').insert(vendas)
  if (error) console.log('  Vendas erro:', error.message)
  else console.log('  ✅ Vendas inseridas:', vendas.length)
}

async function seedConversas() {
  console.log('\n⏳ Seeding CONVERSAS (Inbox)...')
  const conversas = []
  for (let i = 0; i < 15; i++) {
    const nome = NOMES[i % NOMES.length]
    const numero = `557${rand(70,99)}${rand(10000000,99999999)}`
    conversas.push({
      numero,
      nome_contato: nome,
      ultima_mensagem: pick([
        'Boa tarde! Gostaria de saber sobre licenciamento',
        'Quanto custa a transferência de propriedade?',
        'Meu CRLV venceu, o que preciso fazer?',
        'Tenho débitos no DETRAN, vocês regularizam?',
        'Preciso renovar minha CNH, podem me ajudar?',
        'Obrigado! Vou enviar os documentos hoje',
        'Ok, já realizei o pagamento pelo PIX',
        'Quando fica pronto meu serviço?',
      ]),
      ultima_mensagem_at: diasAtras(rand(0, 7)),
      bot_on: pick([true, true, true, false]),
      status: pick(['aberto','aberto','aberto','resolvido']),
      nao_lidas: rand(0, 5),
      criado_em: diasAtras(rand(0, 14)),
    })
  }

  const { error } = await supabase.from('conversas').insert(conversas)
  if (error) console.log('  Conversas erro:', error.message)
  else console.log('  ✅ Conversas inseridas:', conversas.length)
}

async function seedCategoriasFinanceiras() {
  console.log('\n⏳ Seeding CATEGORIAS FINANCEIRAS...')
  const cats = [
    { nome: 'Serviços prestados',   tipo: 'receita',   cor: '#10b981' },
    { nome: 'Licenciamentos',       tipo: 'receita',   cor: '#34d399' },
    { nome: 'Transferências',       tipo: 'receita',   cor: '#6ee7b7' },
    { nome: 'Aluguel',              tipo: 'despesa',   cor: '#ef4444' },
    { nome: 'Folha de pagamento',   tipo: 'despesa',   cor: '#f87171' },
    { nome: 'Infraestrutura',       tipo: 'despesa',   cor: '#fca5a5' },
    { nome: 'Marketing',            tipo: 'despesa',   cor: '#fb923c' },
    { nome: 'Impostos e taxas',     tipo: 'despesa',   cor: '#f97316' },
    { nome: 'Repasse DETRAN',       tipo: 'despesa',   cor: '#ea580c' },
    { nome: 'Investimento negócio', tipo: 'investimento', cor: '#a78bfa' },
  ]
  const { error } = await supabase.from('categorias_financeiras').insert(cats)
  if (error) console.log('  Categorias (já existem ou erro):', error.message)
  else console.log('  ✅ Categorias inseridas:', cats.length)
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Iniciando seed de dados demo — Sistema Cajado\n')
  console.log('URL:', SUPABASE_URL)
  console.log('━'.repeat(55))

  await seedTimes()
  await seedClientes()
  await seedLeads()
  await seedAtividades()
  const contas = await seedContas()
  await seedLancamentos(contas)
  await seedVendas()
  await seedConversas()
  await seedCategoriasFinanceiras()

  console.log('\n' + '━'.repeat(55))
  console.log('✅ SEED CONCLUÍDO! O sistema já tem dados demo.')
  console.log('\n📊 Resumo do que foi criado:')
  console.log('  • 4  Times/Setores (Licenciamento, Transferência...)')
  console.log('  • 20 Clientes (cidade BA, telefones reais)')
  console.log('  • 25 Leads no CRM (em todas as etapas do funil)')
  console.log('  • ~60 Atividades CRM (ligações, WhatsApp, reuniões)')
  console.log('  • 4  Contas financeiras (Bradesco, C6, Caixa, XP)')
  console.log('  • ~70 Lançamentos (receitas + despesas 4 meses)')
  console.log('  • 30 Vendas/Serviços em andamento')
  console.log('  • 15 Conversas no Inbox')
  console.log('  • 10 Categorias financeiras')
  process.exit(0)
}

main().catch(err => {
  console.error('❌ Erro geral:', err)
  process.exit(1)
})
