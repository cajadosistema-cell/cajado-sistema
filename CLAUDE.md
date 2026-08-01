# CLAUDE.md

Diretrizes de comportamento para reduzir erros comuns de LLMs em programação, baseadas nas observações de Andrej Karpathy — traduzidas e adaptadas para os projetos VisioPro.

**Trade-off:** estas diretrizes priorizam cautela em vez de velocidade. Para tarefas triviais, use bom senso.

## 1. Pense antes de codar

**Não presuma. Não esconda confusão. Apresente trade-offs.**

Antes de implementar:
- Declare suas suposições explicitamente. Se estiver incerto, pergunte.
- Se existirem múltiplas interpretações, apresente-as — não escolha em silêncio.
- Se existir uma abordagem mais simples, diga. Discorde quando fizer sentido.
- Se algo estiver confuso, pare. Nomeie o que está confuso. Pergunte.

## 2. Simplicidade primeiro

**O mínimo de código que resolve o problema. Nada especulativo.**

- Nenhuma funcionalidade além do que foi pedido.
- Nenhuma abstração para código de uso único.
- Nenhuma "flexibilidade" ou "configurabilidade" que não foi solicitada.
- Nenhum tratamento de erro para cenários impossíveis.
- Se escreveu 200 linhas e dava para escrever 50, reescreva.

Pergunte a si mesmo: "Um engenheiro sênior diria que isso está complicado demais?" Se sim, simplifique.

## 3. Mudanças cirúrgicas

**Toque apenas no necessário. Limpe apenas a sua própria bagunça.**

Ao editar código existente:
- Não "melhore" código, comentários ou formatação adjacentes.
- Não refatore o que não está quebrado.
- Siga o estilo existente do projeto, mesmo que você faria diferente.
- Se notar código morto não relacionado, mencione — não delete.

Quando suas mudanças criarem órfãos:
- Remova imports/variáveis/funções que SUAS mudanças tornaram inúteis.
- Não remova código morto pré-existente sem que seja pedido.

O teste: cada linha alterada deve rastrear diretamente ao pedido do usuário.

## 4. Execução orientada a objetivos

**Defina critérios de sucesso. Itere até verificar.**

Transforme tarefas em objetivos verificáveis:
- "Adicionar validação" → "Escrever testes para entradas inválidas e fazê-los passar"
- "Corrigir o bug" → "Escrever um teste que reproduz o bug e fazê-lo passar"
- "Refatorar X" → "Garantir que os testes passam antes e depois"

Para tarefas com várias etapas, apresente um plano curto:
```
1. [Etapa] → verificar: [checagem]
2. [Etapa] → verificar: [checagem]
3. [Etapa] → verificar: [checagem]
```

Critérios de sucesso fortes permitem iterar de forma autônoma. Critérios fracos ("faça funcionar") exigem esclarecimentos constantes.

---

## 5. Convenções dos projetos VisioPro

**Stack padrão:**
- Frontend: Next.js + React + TypeScript, deploy na Vercel.
- Backend com conexões persistentes (WhatsApp, websockets, filas): Railway.
- HTML estático: Netlify.
- Banco/auth: Supabase.
- WhatsApp: Evolution API ou Meta Cloud API, conforme o projeto.

**Entregas:**
- Sempre entregar arquivos completos (ou zip), nunca trechos parciais para o usuário localizar e substituir.
- Quando o usuário disser "na sequência", executar as etapas de forma autônoma, sem discussão excessiva de planejamento.
- Responder sempre em português do Brasil.

**Geração de PDF/documentos:**
- Usar wkhtmltopdf com fontes locais do sistema (Liberation Sans, Caladea, DejaVu Sans). Nunca depender de Google Fonts (falha no carregamento).
- Documentos voltados ao cliente final NUNCA devem exibir margens internas, preço unitário por metro ou composição de custos.

**Identidade visual:**
- Interfaces e documentos premium: tema escuro (navy/dourado ou preto/dourado).
- Interfaces operacionais (KDS, cozinha, balcão): tema claro/quente ergonômico (cinza quente, cards brancos) para reduzir fadiga visual em turnos longos.

**Terminologia:**
- Móveis/marcenaria: usar sempre termos da marcenaria brasileira (ex.: "encaixar o fundo no rasgo das laterais"), nunca termos técnicos genéricos.
