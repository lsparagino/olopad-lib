import {
  baseKeymap,
  chainCommands,
  exitCode,
  setBlockType,
  toggleMark,
} from 'prosemirror-commands';
import { redo, undo } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { liftListItem, sinkListItem, splitListItem, wrapInList } from 'prosemirror-schema-list';
import type { MarkType, NodeType, Schema } from 'prosemirror-model';
import type { Command, Plugin } from 'prosemirror-state';

function mark(schema: Schema, name: string): MarkType | null {
  return schema.marks[name] ?? null;
}

function node(schema: Schema, name: string): NodeType | null {
  return schema.nodes[name] ?? null;
}

/**
 * Build the OloType keymap. We layer two keymaps: ours (returned first) and
 * the PM `baseKeymap` (returned second) — the editor wires them in that order
 * so our bindings take precedence.
 */
export function buildKeymaps(schema: Schema): Plugin[] {
  const bindings: Record<string, Command> = {};

  const setBinding = (keys: string[], cmd: Command) => {
    for (const k of keys) bindings[k] = cmd;
  };

  // History
  setBinding(['Mod-z'], undo);
  setBinding(['Mod-y', 'Shift-Mod-z'], redo);

  // Inline marks
  const bold = mark(schema, 'bold');
  if (bold) setBinding(['Mod-b'], toggleMark(bold));

  const italic = mark(schema, 'italic');
  if (italic) setBinding(['Mod-i'], toggleMark(italic));

  const underline = mark(schema, 'underline');
  if (underline) setBinding(['Mod-u'], toggleMark(underline));

  const code = mark(schema, 'code');
  if (code) setBinding(['Mod-`'], toggleMark(code));

  // Headings 1-3 via Cmd+Alt+1/2/3
  const heading = node(schema, 'heading');
  const paragraph = node(schema, 'paragraph');
  if (heading) {
    for (const level of [1, 2, 3] as const) {
      setBinding([`Shift-Mod-${level}`], setBlockType(heading, { level }));
    }
  }
  if (paragraph) setBinding(['Shift-Mod-0'], setBlockType(paragraph));

  // Lists
  const listItem = node(schema, 'list_item');
  if (listItem) {
    setBinding(['Enter'], splitListItem(listItem));
    setBinding(['Mod-['], liftListItem(listItem));
    setBinding(['Mod-]', 'Tab'], sinkListItem(listItem));

    const bulletList = node(schema, 'bullet_list');
    if (bulletList) setBinding(['Shift-Mod-8'], wrapInList(bulletList));
    const orderedList = node(schema, 'ordered_list');
    if (orderedList) setBinding(['Shift-Mod-7'], wrapInList(orderedList));
  }

  // Shift-Enter: exit a code block when at the end, otherwise insert a hard break.
  const hardBreak = node(schema, 'hardBreak');
  if (hardBreak) {
    const insertBr: Command = (state, dispatch) => {
      if (dispatch) {
        dispatch(state.tr.replaceSelectionWith(hardBreak.create()).scrollIntoView());
      }
      return true;
    };
    setBinding(['Shift-Enter'], chainCommands(exitCode, insertBr));
  }

  // Horizontal rule via Mod-_
  const hr = node(schema, 'horizontalRule');
  if (hr) {
    setBinding(['Mod-_'], (state, dispatch) => {
      if (dispatch) dispatch(state.tr.replaceSelectionWith(hr.create()).scrollIntoView());
      return true;
    });
  }

  return [keymap(bindings), keymap(baseKeymap)];
}
