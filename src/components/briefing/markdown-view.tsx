import { type Block, type Inline, parseMarkdown } from "@/lib/markdown";
import { cn } from "@/lib/utils";

function Inlines({ nodes }: { nodes: Inline[] }) {
  return nodes.map((node, i) => {
    switch (node.type) {
      case "text":
        return <span key={i}>{node.text}</span>;
      case "bold":
        return (
          <strong key={i} className="font-semibold">
            <Inlines nodes={node.children} />
          </strong>
        );
      case "italic":
        return (
          <em key={i}>
            <Inlines nodes={node.children} />
          </em>
        );
      case "code":
        return (
          <code key={i} className="rounded-md bg-surface-hover px-1 py-0.5 text-[0.9em]">
            {node.text}
          </code>
        );
      case "link":
        return (
          <a
            key={i}
            href={node.href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
          >
            <Inlines nodes={node.children} />
          </a>
        );
    }
  });
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "heading":
      return block.level === 1 ? (
        <h3 className="text-lg font-semibold tracking-tight">
          <Inlines nodes={block.children} />
        </h3>
      ) : (
        <h3 className="pt-2 text-[1.02rem] font-semibold tracking-tight">
          <Inlines nodes={block.children} />
        </h3>
      );
    case "paragraph":
      return (
        <p>
          <Inlines nodes={block.children} />
        </p>
      );
    case "quote":
      return (
        <blockquote className="border-l-2 border-line pl-3 text-muted">
          <Inlines nodes={block.children} />
        </blockquote>
      );
    case "rule":
      return <hr className="border-line" />;
    case "list": {
      const List = block.ordered ? "ol" : "ul";
      return (
        <List className={cn("flex flex-col gap-1.5 pl-5", block.ordered ? "list-decimal" : "list-disc")}>
          {block.items.map((item, i) => (
            <li key={i} className="pl-0.5 marker:text-faint">
              <Inlines nodes={item} />
            </li>
          ))}
        </List>
      );
    }
  }
}

/** Markdown written by Claude, shown as plain text and web links (never as HTML). */
export function MarkdownView({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3 text-[0.95rem] leading-relaxed", className)}>
      {parseMarkdown(text).map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </div>
  );
}
