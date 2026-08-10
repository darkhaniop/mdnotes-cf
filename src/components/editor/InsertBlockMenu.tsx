import { Fragment, type ComponentType } from 'react';
import {
  ChevronDown,
  Code,
  ListChecks,
  Minus,
  Plus,
  Quote,
  Radical,
  Sigma,
  Table,
  Workflow,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MARKDOWN_SNIPPETS, type MarkdownSnippet } from './markdown-snippets';

type IconComponent = ComponentType<{ className?: string }>;

const ICONS: Record<string, IconComponent> = {
  mermaid: Workflow,
  table: Table,
  equation: Sigma,
  'inline-math': Radical,
  code: Code,
  blockquote: Quote,
  'task-list': ListChecks,
  hr: Minus,
};

/** Snippets after this id are separated off as the small/inline ones. */
const INLINE_GROUP_STARTS_AT = 'blockquote';

/**
 * A toolbar dropdown rather than a side strip: edit mode already spends its
 * horizontal budget on the editor/preview split and the asset panel, and a
 * portalled menu costs no layout at all, so toggling the preview is unaffected.
 */
export function InsertBlockMenu({ onInsert }: { onInsert: (snippet: MarkdownSnippet) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" data-testid="insert-block">
          <Plus /> Insert
          <ChevronDown className="size-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {MARKDOWN_SNIPPETS.map((snippet) => {
          const Icon = ICONS[snippet.id];
          return (
            <Fragment key={snippet.id}>
              {snippet.id === INLINE_GROUP_STARTS_AT ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem
                data-testid={`insert-${snippet.id}`}
                onSelect={() => onInsert(snippet)}
              >
                {Icon ? <Icon className="size-4 shrink-0 opacity-70" /> : null}
                {snippet.label}
              </DropdownMenuItem>
            </Fragment>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
