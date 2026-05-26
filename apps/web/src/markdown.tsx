import React from 'react';

// Sidcord mesaj markdown — Discord-stiline yakın hafif parser
// Destekler: **bold**, *italic*, __underline__, ~~strike~~, `inline code`,
// ```code block```, > blockquote, ||spoiler||, URLs, @mentions

type Node =
  | { kind: 'text'; value: string }
  | { kind: 'bold'; children: Node[] }
  | { kind: 'italic'; children: Node[] }
  | { kind: 'underline'; children: Node[] }
  | { kind: 'strike'; children: Node[] }
  | { kind: 'code'; value: string }
  | { kind: 'codeblock'; lang: string; value: string }
  | { kind: 'blockquote'; children: Node[] }
  | { kind: 'spoiler'; children: Node[] }
  | { kind: 'link'; href: string }
  | { kind: 'mention'; username: string };

// inline parser — recursive
function parseInline(src: string): Node[] {
  const out: Node[] = [];
  let i = 0;
  while (i < src.length) {
    // URL
    const urlMatch = src.slice(i).match(/^https?:\/\/[^\s]+/);
    if (urlMatch) {
      out.push({ kind: 'link', href: urlMatch[0] });
      i += urlMatch[0].length;
      continue;
    }
    // Inline code
    if (src[i] === '`') {
      const end = src.indexOf('`', i + 1);
      if (end > i) {
        out.push({ kind: 'code', value: src.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    // Spoiler ||...||
    if (src.startsWith('||', i)) {
      const end = src.indexOf('||', i + 2);
      if (end > i) {
        out.push({ kind: 'spoiler', children: parseInline(src.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }
    // Bold **
    if (src.startsWith('**', i)) {
      const end = src.indexOf('**', i + 2);
      if (end > i) {
        out.push({ kind: 'bold', children: parseInline(src.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }
    // Underline __
    if (src.startsWith('__', i)) {
      const end = src.indexOf('__', i + 2);
      if (end > i) {
        out.push({ kind: 'underline', children: parseInline(src.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }
    // Strike ~~
    if (src.startsWith('~~', i)) {
      const end = src.indexOf('~~', i + 2);
      if (end > i) {
        out.push({ kind: 'strike', children: parseInline(src.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }
    // Italic *
    if (src[i] === '*') {
      const end = src.indexOf('*', i + 1);
      if (end > i) {
        out.push({ kind: 'italic', children: parseInline(src.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }
    // Mention @username
    const mention = src.slice(i).match(/^@([a-z0-9_.]{3,32})/i);
    if (mention) {
      out.push({ kind: 'mention', username: mention[1] });
      i += mention[0].length;
      continue;
    }

    // Default text
    let txt = '';
    while (
      i < src.length &&
      src[i] !== '`' &&
      !src.startsWith('||', i) &&
      !src.startsWith('**', i) &&
      !src.startsWith('__', i) &&
      !src.startsWith('~~', i) &&
      src[i] !== '*' &&
      !/^https?:\/\//.test(src.slice(i)) &&
      !/^@[a-z0-9_.]/i.test(src.slice(i))
    ) {
      txt += src[i];
      i++;
    }
    if (txt.length === 0 && i < src.length) {
      txt = src[i];
      i++;
    }
    if (txt) out.push({ kind: 'text', value: txt });
  }
  return out;
}

function parseBlocks(src: string): Node[] {
  const out: Node[] = [];
  const lines = src.split('\n');
  let i = 0;
  while (i < lines.length) {
    const ln = lines[i];

    // Code block ```lang
    if (ln.startsWith('```')) {
      const lang = ln.slice(3).trim();
      let code = '';
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        code += lines[i] + '\n';
        i++;
      }
      i++; // closing ```
      out.push({ kind: 'codeblock', lang, value: code.replace(/\n$/, '') });
      continue;
    }

    // Blockquote
    if (ln.startsWith('> ')) {
      let quote = ln.slice(2);
      i++;
      while (i < lines.length && lines[i].startsWith('> ')) {
        quote += '\n' + lines[i].slice(2);
        i++;
      }
      out.push({ kind: 'blockquote', children: parseInline(quote) });
      continue;
    }

    // Boş satır → newline olarak ekle
    // Birden fazla satırı tek paragraf yapmak yerine her satırı düz inline parse edelim
    const inline = parseInline(ln);
    out.push(...inline);
    if (i < lines.length - 1) out.push({ kind: 'text', value: '\n' });
    i++;
  }
  return out;
}

function renderNode(n: Node, key: number, openMention?: (u: string) => void): React.ReactNode {
  switch (n.kind) {
    case 'text':
      return <React.Fragment key={key}>{n.value}</React.Fragment>;
    case 'bold':
      return <strong key={key}>{n.children.map((c, i) => renderNode(c, i, openMention))}</strong>;
    case 'italic':
      return <em key={key}>{n.children.map((c, i) => renderNode(c, i, openMention))}</em>;
    case 'underline':
      return <u key={key}>{n.children.map((c, i) => renderNode(c, i, openMention))}</u>;
    case 'strike':
      return <s key={key}>{n.children.map((c, i) => renderNode(c, i, openMention))}</s>;
    case 'code':
      return (
        <code key={key} className="bg-surface-2 text-brand-400 rounded px-1 py-0.5 text-[13px] font-mono">
          {n.value}
        </code>
      );
    case 'codeblock':
      return (
        <pre
          key={key}
          className="bg-surface-2 border border-line rounded-lg p-3 my-1 overflow-x-auto"
        >
          {n.lang && (
            <div className="text-[10px] text-ink-tertiary uppercase mb-1">{n.lang}</div>
          )}
          <code className="text-[13px] font-mono text-ink-primary whitespace-pre">{n.value}</code>
        </pre>
      );
    case 'blockquote':
      return (
        <blockquote key={key} className="border-l-4 border-line pl-3 my-1 text-ink-secondary">
          {n.children.map((c, i) => renderNode(c, i, openMention))}
        </blockquote>
      );
    case 'spoiler':
      return <Spoiler key={key} nodes={n.children} openMention={openMention} />;
    case 'link':
      return (
        <a
          key={key}
          href={n.href}
          target="_blank"
          rel="noreferrer"
          className="text-brand-500 hover:text-brand-400 hover:underline"
        >
          {n.href}
        </a>
      );
    case 'mention':
      return (
        <button
          key={key}
          onClick={() => openMention?.(n.username)}
          className="bg-brand-500/15 text-brand-500 font-semibold rounded px-1 py-0.5 hover:bg-brand-500/25"
        >
          @{n.username}
        </button>
      );
  }
}

function Spoiler({
  nodes,
  openMention,
}: {
  nodes: Node[];
  openMention?: (u: string) => void;
}) {
  const [shown, setShown] = React.useState(false);
  return (
    <span
      onClick={() => setShown(true)}
      className={
        'rounded px-1 cursor-pointer ' +
        (shown ? 'bg-surface-2' : 'bg-black text-black select-none')
      }
    >
      {nodes.map((n, i) => renderNode(n, i, openMention))}
    </span>
  );
}

export function Markdown({ content, onMention }: { content: string; onMention?: (u: string) => void }) {
  const nodes = parseBlocks(content);
  return <>{nodes.map((n, i) => renderNode(n, i, onMention))}</>;
}
