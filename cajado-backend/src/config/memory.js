const bcrypt = require("bcryptjs");
const env = require("./env");

const botPausado = new Map();
const conversas = new Map();
const conversationHistory = new Map();
const clientesTransferidos = new Map();
const processedMessages = new Set();
const usuariosMemoria = new Map();
const timesMemoria = new Map();
const configMemoria = new Map();
const canaisMemoria = new Map();

const ADMIN_DEFAULT = {
  id: "admin-1",
  nome: "Admin",
  email: env.ADMIN_EMAIL,
  senha: bcrypt.hashSync(env.ADMIN_SENHA, 10),
  role: "admin",
  setor: "todos",
  ativo: true,
  empresa_id: "empresa-padrao"
};
usuariosMemoria.set(ADMIN_DEFAULT.email, ADMIN_DEFAULT);

[
  { id: "financeiro",   nome: "Financeiro",          descricao: "Controle de lançamentos, fluxo de caixa, contas e relatórios financeiros",         palavras_chave: "financeiro, lancamento, conta, caixa, pagamento, boleto, relatorio, dre",                             cor: "#f59e0b", emoji: "💰", ativo: true },
  { id: "contabilidade",nome: "Assessoria Contábil",  descricao: "Contabilidade, imposto, nota fiscal, declarações e regularização fiscal",          palavras_chave: "contabilidade, imposto, nf, nota fiscal, ir, simples nacional, cnpj, abertura empresa, mei",             cor: "#3b82f6", emoji: "📊", ativo: true },
  { id: "juridico",     nome: "Jurídico",             descricao: "Contratos, assessoria jurídica, compliance, trabalhista e societário",             palavras_chave: "juridico, contrato, trabalhista, rescisao, processo, advogado, compliance, socio, estatuto",            cor: "#8b5cf6", emoji: "⚖️", ativo: true },
  { id: "suporte",      nome: "Suporte",              descricao: "Ajuda com o sistema, dúvidas de uso, erros e atendimento técnico",                  palavras_chave: "duvida, erro, ajuda, suporte, tecnico, sistema, cadastro, acesso, senha, bug",                         cor: "#10b981", emoji: "🛠️", ativo: true },
].forEach(t => timesMemoria.set(t.id, t));

const MAX_HISTORY = 12;

module.exports = {
  botPausado,
  conversas,
  conversationHistory,
  clientesTransferidos,
  processedMessages,
  MAX_HISTORY,
  usuariosMemoria,
  ADMIN_DEFAULT,
  timesMemoria,
  configMemoria,
  canaisMemoria,
};
