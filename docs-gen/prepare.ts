
import fs from 'fs-extra';
import path from 'path';

async function build() {
    const docMd = await fs.readFile('../DOCUMENTATION.md', 'utf-8');
    const template = await fs.readFile('./index.html', 'utf-8');

    // Escape backticks in MD for JS template string
    const escapedMd = docMd.replace(/`/g, '\\`').replace(/\$/g, '\\$');

    const finalHtml = template.replace('CONTENT_PLACEHOLDER', escapedMd);

    await fs.writeFile('./index.html', finalHtml);
    console.log('Markdown injected into template.');
}

build().catch(console.error);
