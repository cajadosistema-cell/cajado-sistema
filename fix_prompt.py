import re
with open(r'd:\projetos visiopro\cajado-sistema01\components\shared\SecretariaFlutuanteV2\elena-prompt.ts', 'r', encoding='utf-8') as f:
    text = f.read()

replacements = {
    'dinǽmico': 'dinâmico',
    'utilitǭrios': 'utilitários',
    'formataǜo': 'formatação',
    'Olǭ': 'Olá',
    'Y\'<': '👋',
    'Y?Y\'': '🏢💸',
    'Y\'': '💸',
    'Y"S': '📈',
    'Y".': '📅',
    'Y"<': '🚨',
    'Y-\'?': '📝',
    'Y"^': '📊',
    'Y""': '🔄',
    '?O': '❌',
    'YZ': '🎯',
    'o.': '✅',
    'Y?': '🏦',
    'Y"z': '👤',
    'Y\'\'': '🔒',
    'Y"Z': '🔍',
    'o??': '✏️',
    'OcorrǦncia': 'Ocorrência',
    'TransferǦncia': 'Transferência',
    'prximo': 'próximo',
    'lanamento': 'lançamento',
    'informaǜo': 'informação',
    'aǜo': 'ação',
    'Aǜo': 'Ação',
    'exibiǜo': 'exibição',
    'invǭlido': 'inválido',
    'genǸrico': 'genérico',
    'mǦs': 'mês',
    'Relatrio': 'Relatório',
    '?': '•',
    '\'': '→',
    '?"': '—',
    'Y"': '📅',
    'Y?': '🏦',
    'Y': '📌',
    'o': '✨',
}

for k, v in replacements.items():
    text = text.replace(k, v)

with open(r'd:\projetos visiopro\cajado-sistema01\components\shared\SecretariaFlutuanteV2\elena-prompt.ts', 'w', encoding='utf-8') as f:
    f.write(text)
print('Fixed prompt!')
