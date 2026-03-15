/**
 * Build PDFs from client-docs Markdown files.
 * Run: npm run docs:pdf
 * Output: client-docs/output/*.pdf
 *
 * Mermaid code blocks are pre-rendered to PNG and injected so diagrams
 * appear as images in the PDF.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { mdToPdf } = require('md-to-pdf');

const CLIENT_DOCS = path.join(__dirname, '..', 'client-docs');
const OUTPUT_DIR = path.join(CLIENT_DOCS, 'output');
const MERMAID_DIR = path.join(OUTPUT_DIR, 'mermaid');

const DOC_FILES = [
  'README.md',
  'newsletter.md',
  'post-radar.md',
  'campaign-manager-automations.md',
  'dossiers.md',
  'hubspot.md',
  'flows.md',
];

const MERMAID_BLOCK_RE = /```mermaid\n([\s\S]*?)```/g;

function getMmdcPath() {
  const base = path.join(__dirname, '..', 'node_modules', '.bin', 'mmdc');
  return process.platform === 'win32' ? base + '.cmd' : base;
}

function renderMermaidToPng(mermaidCode, outputPath) {
  const mmdc = getMmdcPath();
  if (!fs.existsSync(path.dirname(mmdc))) {
    throw new Error(
      'Mermaid CLI not found. Run: npm install @mermaid-js/mermaid-cli --save-dev'
    );
  }
  const tmp = path.join(OUTPUT_DIR, `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}.mmd`);
  fs.writeFileSync(tmp, mermaidCode.trim(), 'utf8');
  try {
    execSync(`"${mmdc}" -i "${tmp}" -o "${outputPath}" -b white`, {
      stdio: 'pipe',
      maxBuffer: 10 * 1024 * 1024,
    });
  } finally {
    try { fs.unlinkSync(tmp); } catch (_) {}
  }
}

function preprocessMermaidInMarkdown(content, docBaseName) {
  const blocks = [];
  let match;
  const re = new RegExp(MERMAID_BLOCK_RE.source, 'g');
  while ((match = re.exec(content)) !== null) {
    blocks.push({ full: match[0], code: match[1], index: blocks.length });
  }
  if (blocks.length === 0) return content;

  if (!fs.existsSync(MERMAID_DIR)) {
    fs.mkdirSync(MERMAID_DIR, { recursive: true });
  }

  let out = content;
  for (const { full, code, index } of blocks) {
    const pngName = `${docBaseName}-${index}.png`;
    const pngPath = path.join(MERMAID_DIR, pngName);
    renderMermaidToPng(code, pngPath);
    const imgMarkdown = `\n![Diagram ${index + 1}](mermaid/${pngName})\n`;
    out = out.replace(full, imgMarkdown);
  }
  return out;
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  for (const name of DOC_FILES) {
    const src = path.join(CLIENT_DOCS, name);
    if (!fs.existsSync(src)) {
      console.warn('Skip (not found):', name);
      continue;
    }
    const base = path.basename(name, '.md');
    const dest = path.join(OUTPUT_DIR, `${base}.pdf`);
    try {
      let input = { path: src };
      const raw = fs.readFileSync(src, 'utf8');
      const hasMermaid = /```mermaid\n([\s\S]*?)```/.test(raw);
      if (hasMermaid) {
        console.log('Rendering Mermaid diagrams in', name, '...');
        const processed = preprocessMermaidInMarkdown(raw, base);
        input = { content: processed };
      }

      await mdToPdf(input, {
        dest,
        ...(input.content ? { basedir: OUTPUT_DIR } : {}),
        pdf_options: { format: 'A4', margin: '20mm', printBackground: true },
      });
      console.log('OK:', name, '->', path.relative(CLIENT_DOCS, dest));
    } catch (err) {
      console.error('FAIL:', name, err.message);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
