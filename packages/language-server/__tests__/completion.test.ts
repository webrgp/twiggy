import { describe, test, before } from 'node:test'
import * as assert from 'node:assert/strict'
import { filters } from '../src/completions/filters';
import Parser from 'web-tree-sitter';
import { twigFilters } from '../src/staticCompletionInfo';
import { localVariables } from '../src/completions/local-variables';
import { CompletionItemKind } from 'vscode-languageserver';
import { documentFromCode, initializeTestParser } from './utils';

describe('completion', () => {
    let parser!: Parser;

    before(async () => {
        parser = await initializeTestParser();
    });

    test('in empty output, {{| }}', async () => {
        const code = `{% set variable = 123 %}{{ }}`;
        const document = documentFromCode(code);

        const completions = localVariables(
            document,
            document.deepestAt({ line: 0, character: `{% set variable = 123 %}{{`.length })!,
        );

        const completionFound = completions.find((item) => item.label === 'variable');
        assert.ok(completionFound, 'variable not in completions.');
    });

    test('in empty output, {{ |}}', async () => {
        const code = `{% set variable = 123 %}{{ }}`;
        const document = documentFromCode(code);

        const completions = localVariables(
            document,
            document.deepestAt({ line: 0, character: `{% set variable = 123 %}{{ `.length })!,
        );

        const completionFound = completions.find((item) => item.label === 'variable');
        assert.ok(completionFound, 'variable not in completions.');
    });

    test('in empty if, {% if | %}', async () => {
        const code = `{% set var = 1 %}{% if  %}{% endif %}`;
        const document = documentFromCode(code);

        const completions = localVariables(
            document,
            document.deepestAt({ line: 0, character: `{% set var = 1 %}{% if `.length })!,
        );

        assert.equal(completions[0]?.label, 'var');
    });

    test('in empty for, {% for el in | %}', async () => {
        const code = `{% set users = [1, 2] %}{% for u in  %}{% endfor %}`;
        const document = documentFromCode(code);

        const completions = localVariables(
            document,
            document.deepestAt({ line: 0, character: `{% set users = [1, 2] %}{% for u in `.length })!,
        );

        assert.equal(completions[0]?.label, 'users');
    });

    test('localVariables', async () => {
        const code = `{% set variable = 123 %}{{ v^ }}`;
        const document = documentFromCode(code);

        const completions = localVariables(
            document,
            document.deepestAt({ line: 0, character: code.indexOf('^') })!,
        );

        const completionFound = completions.find((item) => item.label === 'variable');
        assert.ok(completionFound, 'variable not in completions.');
        assert.ok(completionFound.detail === '123', 'variable value not in completions.');
        assert.ok(completionFound.kind === CompletionItemKind.Field, 'wrong variable type.');
    });

    test('filters', async () => {
        const code = `{{ something|^ }}`;
        const document = documentFromCode(code);
        const cursorNode = document.deepestAt({ line: 0, character: code.indexOf('^') })!;
        const customFilters = [
            { identifier: 'custom_filter_without_args', arguments: [] },
            {
                identifier: 'custom_filter_with_args',
                arguments: [
                    { identifier: 'arg1', defaultValue: 'default' },
                ],
            },
        ];
        const completions = filters(cursorNode, customFilters);

        twigFilters.every((filter) => {
            assert.ok(
                completions.some((item) => item.label === filter.label),
                `${filter.label} not in completions.`,
            );
        });

        customFilters.every((filter) => {
            assert.ok(
                completions.some((item) => item.label === filter.identifier),
                `${filter.identifier} not in completions.`,
            );
        });

        assert.equal(completions.length, twigFilters.length + customFilters.length);
    });
});
