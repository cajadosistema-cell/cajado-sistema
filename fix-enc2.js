const fs = require('fs');
const path = require('path');

function fixEncoding(text) {
    try {
        // Only convert if it looks like it has corrupted utf-8-as-latin1 characters
        if (text.includes('Ã') || text.includes('ð') || text.includes('â€') || text.includes('âš')) {
            const buf = Buffer.from(text, 'latin1');
            const fixed = buf.toString('utf8');
            // If the fixed text still has the replacement character "", it means the conversion failed
            if (!fixed.includes('')) {
                return fixed;
            }
        }
    } catch (e) {
        // ignore
    }
    return text;
}

const dirsToScan = [
    path.join(__dirname, 'components', 'shared', 'SecretariaFlutuanteV2'),
    path.join(__dirname, 'components', 'shared'),
    path.join(__dirname, 'cajado-backend', 'src', 'routes'),
    path.join(__dirname, 'cajado-backend', 'src', 'services')
];

let filesChanged = 0;

function processDirectory(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filepath = path.join(dir, file);
        if (fs.statSync(filepath).isDirectory()) {
            // Do not recurse to avoid messing up other things, just process top level of these dirs
        } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js')) {
            let text = fs.readFileSync(filepath, 'utf8');
            let newText = fixEncoding(text);
            
            // Manual fallback for specific known strings that Buffer might not have caught if mixed
            const manualReplacements = {
                'â”€': '─',
                'ðŸ§ ': '🧠',
                'ðŸ“ ': '📌',
                'â€¢': '•',
                'â†’': '→',
                'ðŸš¨': '🚨',
                'ðŸ’³': '💳',
                'â °': '⏰',
                'âœ…': '✅',
                'ðŸ ¢': '🏢',
                'ðŸ’¸': '💸',
                'ðŸ’¡': '💡',
                'ðŸ“‹': '📋',
                'ðŸ—‚ï¸ ': '🗂️',
                'ðŸ“ˆ': '📈',
                'ðŸ”„': '🔄',
                'â Œ': '❌',
                'ðŸŽ¯': '🎯',
                'ðŸ‘¥': '👥',
                'ðŸ“Š': '📊',
                'ðŸ ¦': '🏦',
                'â­ ': '⭐',
                'ðŸ“ž': '📞',
                'ðŸ¤ ': '🤝',
                'ðŸ‘¤': '👤',
                'ðŸ”Ž': '🔍',
                'âœ ï¸ ': '✏️',
                'âš ï¸ ': '⚠️',
                'ðŸ“…': '📅',
                'ðŸ’°': '💰'
            };
            
            for (const [k, v] of Object.entries(manualReplacements)) {
                newText = newText.split(k).join(v);
            }

            if (text !== newText) {
                fs.writeFileSync(filepath, newText, 'utf8');
                console.log('Fixed:', filepath);
                filesChanged++;
            }
        }
    }
}

dirsToScan.forEach(processDirectory);
console.log('Total files fixed:', filesChanged);
