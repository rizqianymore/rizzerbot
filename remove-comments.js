import fs from 'fs';
import path from 'path';

function stripComments(code) {
    let inString = false;
    let stringChar = '';
    let inRegex = false;
    let inBlockComment = false;
    let inLineComment = false;
    let result = '';

    for (let i = 0; i < code.length; i++) {
        const char = code[i];
        const next = code[i + 1] || '';
        const prev = code[i - 1] || '';

        if (inBlockComment) {
            if (char === '*' && next === '/') {
                inBlockComment = false;
                i++;
            }
            continue;
        }

        if (inLineComment) {
            if (char === '\n' || char === '\r') {
                inLineComment = false;
                result += char;
            }
            continue;
        }

        if (inString) {
            result += char;
            if (char === stringChar && prev !== '\\') {
                inString = false;
            }
            continue;
        }

        if (inRegex) {
            result += char;
            if (char === '/' && prev !== '\\') {
                inRegex = false;
            }
            continue;
        }

        if (char === '/' && next === '*') {
            inBlockComment = true;
            i++;
            continue;
        }

        if (char === '/' && next === '/') {
            inLineComment = true;
            i++;
            continue;
        }

        if (char === '"' || char === "'" || char === '`') {
            inString = true;
            stringChar = char;
            result += char;
            continue;
        }

        if (char === '/') {
            const trimmedResult = result.trim();
            const lastChar = trimmedResult[trimmedResult.length - 1];
            if (['=', '(', ',', '{', '[', ':', ';', '!', '&', '|', '?', '+', '-', '*', '%'].includes(lastChar) || !lastChar) {
                inRegex = true;
                result += char;
                continue;
            }
        }

        result += char;
    }
    return result;
}

function getFilesRecursive(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of list) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
            if (file.name !== 'node_modules' && file.name !== '.git') {
                results = results.concat(getFilesRecursive(fullPath));
            }
        } else if (file.isFile() && file.name.endsWith('.js')) {
            results.push(fullPath);
        }
    }
    return results;
}

const rootDir = process.cwd();
const jsFiles = [
    path.join(rootDir, 'index.js'),
    ...getFilesRecursive(path.join(rootDir, 'lib')),
    ...getFilesRecursive(path.join(rootDir, 'plugins')),
    ...getFilesRecursive(path.join(rootDir, 'config'))
];

console.log(`Processing ${jsFiles.length} JavaScript files...`);

for (const file of jsFiles) {
    if (!fs.existsSync(file) || file.endsWith('remove-comments.js')) continue;
    try {
        const content = fs.readFileSync(file, 'utf8');
        const cleaned = stripComments(content);
        fs.writeFileSync(file, cleaned, 'utf8');
        console.log(`Cleaned comments from: ${path.relative(rootDir, file)}`);
    } catch (err) {
        console.error(`Failed to process ${file}:`, err.message);
    }
}

console.log('All comments have been removed successfully.');
