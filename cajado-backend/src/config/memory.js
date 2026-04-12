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
  { id: "vendas", nome: "Vendas", descricao: "Equipe comercial, fechamento de propostas e novos negócios", palavras_chave: "comprar, preco, orcamento, venda, comercial", cor: "#3b82f6", emoji: "💼", ativo: true },
  { id: "suporte", nome: "Suporte", descricao: "Atendimento técnico, dúvidas de uso e auxílio em problemas", palavras_chave: "duvida, erro, ajuda, suporte, tecnico", cor: "#10b981", emoji: "🛠️", ativo: true },
  { id: "financeiro", nome: "Financeiro", descricao: "Setor para tratar de pagamentos, boletos, NF e pendências", palavras_chave: "pagamento, boleto, nf, nota fiscal, financeiro, dinheiro", cor: "#f59e0b", emoji: "💰", ativo: true },
  { id: "marketing", nome: "Marketing", descricao: "Gestão de campanhas, parcerias e afiliados", palavras_chave: "campanha, parceria, marketing, afiliado", cor: "#8b5cf6", emoji: "📊", ativo: true }
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
