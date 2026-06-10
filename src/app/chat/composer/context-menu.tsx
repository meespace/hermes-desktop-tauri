import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Clipboard, FileText, FolderOpen, type IconComponent, ImageIcon, Link, MessageSquareText } from '@/lib/icons'
import { cn } from '@/lib/utils'

import { GHOST_ICON_BTN } from './controls'
import type { ChatBarState } from './types'

const PROMPT_SNIPPETS: readonly PromptSnippet[] = [
  {
    description: 'Audit the current change for regressions, dropped edge cases, and missing tests.',
    label: 'Code review',
    text: 'Please review this for bugs, regressions, and missing tests.'
  },
  {
    description: 'Outline an approach before touching code so the diff stays focused.',
    label: 'Implementation plan',
    text: 'Please make a concise implementation plan before changing code.'
  },
  {
    description: 'Walk through how the selected code works and link to the key files.',
    label: 'Explain this',
    text: 'Please explain how this works and point me to the key files.'
  }
]

export function ContextMenu({
  state,
  onInsertText,
  onOpenUrlDialog,
  onPasteClipboardImage,
  onPickFiles,
  onPickFolders,
  onPickImages
}: ContextMenuProps) {
  // Prompt snippets used to be a Radix submenu. That submenu didn't open
  // reliably when the parent menu was positioned at the bottom of the
  // window (composer "+" anchor), so we promoted it to a real Dialog —
  // easier to grow with search / descriptions, and no positioning math.
  const [snippetsOpen, setSnippetsOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={state.tools.label}
            className={cn(
              GHOST_ICON_BTN,
              'data-[state=open]:border-[var(--border)] data-[state=open]:bg-[var(--surface-secondary)] data-[state=open]:text-foreground'
            )}
            disabled={!state.tools.enabled}
            size="icon"
            title={state.tools.label}
            type="button"
            variant="ghost"
          >
            <Codicon name="add" size="1rem" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60" side="top" sideOffset={10}>
          <DropdownMenuLabel className="text-[0.7rem] font-medium uppercase tracking-wide text-[var(--muted)]">
            Attach
          </DropdownMenuLabel>
          <ContextMenuItem disabled={!onPickFiles} icon={FileText} onSelect={onPickFiles}>
            Files…
          </ContextMenuItem>
          <ContextMenuItem disabled={!onPickFolders} icon={FolderOpen} onSelect={onPickFolders}>
            Folder…
          </ContextMenuItem>
          <ContextMenuItem disabled={!onPickImages} icon={ImageIcon} onSelect={onPickImages}>
            Images…
          </ContextMenuItem>
          <ContextMenuItem disabled={!onPasteClipboardImage} icon={Clipboard} onSelect={onPasteClipboardImage}>
            Paste image
          </ContextMenuItem>
          <ContextMenuItem icon={Link} onSelect={onOpenUrlDialog}>
            URL…
          </ContextMenuItem>

          <DropdownMenuSeparator />

          <ContextMenuItem icon={MessageSquareText} onSelect={() => setSnippetsOpen(true)}>
            Prompt snippets…
          </ContextMenuItem>

          <DropdownMenuSeparator />

          <div className="px-2 py-1 text-[0.7rem] text-[var(--muted)]">
            Tip: type <kbd className="rounded bg-[var(--surface-secondary)] px-1 py-px font-mono text-[0.65rem]">@</kbd> to reference files
            inline.
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <PromptSnippetsDialog
        onInsertText={onInsertText}
        onOpenChange={setSnippetsOpen}
        open={snippetsOpen}
        snippets={PROMPT_SNIPPETS}
      />
    </>
  )
}

function PromptSnippetsDialog({
  onInsertText,
  onOpenChange,
  open,
  snippets
}: PromptSnippetsDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-md gap-3 border-[var(--border)] bg-[var(--overlay)] shadow-[var(--overlay-shadow)]">
        <DialogHeader>
          <DialogTitle>Prompt snippets</DialogTitle>
          <DialogDescription>Pick a starter prompt to drop into the composer.</DialogDescription>
        </DialogHeader>
        <ul className="grid gap-1">
          {snippets.map(snippet => (
            <li key={snippet.label}>
              <button
                className="group/snippet flex w-full cursor-pointer items-start gap-2.5 rounded-[calc(var(--radius)*1.25)] border border-transparent px-2.5 py-2 text-left transition-[background-color,border-color,color,box-shadow] hover:border-[var(--border)] hover:bg-[var(--surface-secondary)] focus-visible:border-[var(--border)] focus-visible:bg-[var(--surface-secondary)] focus-visible:outline-none"
                onClick={() => {
                  onInsertText(snippet.text)
                  onOpenChange(false)
                }}
                type="button"
              >
                <MessageSquareText className="mt-0.5 size-3.5 shrink-0 text-[var(--muted)] group-hover/snippet:text-foreground" />
                <span className="grid min-w-0 gap-0.5">
                  <span className="text-sm font-medium text-foreground">{snippet.label}</span>
                  <span className="text-[length:var(--conversation-caption-font-size)] text-[var(--muted)]">
                    {snippet.description}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}

export function ContextMenuItem({
  children,
  disabled,
  icon: Icon,
  onSelect
}: ContextMenuItemProps) {
  return (
    <DropdownMenuItem disabled={disabled} onSelect={onSelect}>
      <Icon />
      <span>{children}</span>
    </DropdownMenuItem>
  )
}

interface ContextMenuItemProps {
  children: string
  disabled?: boolean
  icon: IconComponent
  onSelect?: () => void
}

interface ContextMenuProps {
  onInsertText: (text: string) => void
  onOpenUrlDialog: () => void
  onPasteClipboardImage?: () => void
  onPickFiles?: () => void
  onPickFolders?: () => void
  onPickImages?: () => void
  state: ChatBarState
}

interface PromptSnippet {
  description: string
  label: string
  text: string
}

interface PromptSnippetsDialogProps {
  onInsertText: (text: string) => void
  onOpenChange: (open: boolean) => void
  open: boolean
  snippets: readonly PromptSnippet[]
}
