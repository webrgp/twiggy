import { CompletionItemKind } from 'vscode-languageserver/node';
import { SyntaxNode } from 'web-tree-sitter';
import { forLoopProperties } from '../common';
import { findParentByType } from '../utils/node';
import { isEmptyEmbedded } from '../utils/node';

export function forLoop(cursorNode: SyntaxNode) {
  if (!findParentByType(cursorNode, 'for')) {
    return;
  }

  if (
    cursorNode.text === '.' &&
    cursorNode.previousSibling?.type === 'variable' &&
    cursorNode.previousSibling.text === 'loop'
  ) {
    return forLoopProperties;
  }

  if (cursorNode.type === 'variable' || isEmptyEmbedded(cursorNode)) {
    return [
      {
        label: 'loop',
        kind: CompletionItemKind.Variable,
      },
    ];
  }
}
