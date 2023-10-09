import {
    Connection,
    Definition,
    DefinitionParams,
    DocumentUri,
    Range,
} from 'vscode-languageserver';
import { Server } from '../server';
import { findNodeByPosition } from '../utils/findElementByPosition';
import { SyntaxNode } from 'web-tree-sitter';
import {
    templateUsingFunctions,
    templateUsingStatements,
} from '../constants/template-usage';
import { Document } from '../documents';
import { getStringNodeValue } from '../utils/node';
import { rangeContainsPosition } from '../utils/range-contains-position';
import { pointToPosition } from '../utils/point-to-position';
import { TemplatePathMapping } from '../utils/symfony/twigConfig';
import { documentUriToFsPath } from '../utils/document-uri-to-fs-path';
import { fileStat } from '../utils/files/fileStat';
import * as path from 'path';
import { toDocumentUri } from '../utils/toDocumentUri';

export type onDefinitionHandlerReturn = ReturnType<
    Parameters<Connection['onDefinition']>[0]
>;

const isFunctionCall = (
    node: SyntaxNode | null,
    functionName: string,
): boolean => {
    return (
        !!node &&
        node.type === 'call_expression' &&
        node.childForFieldName('name')?.text === functionName
    );
};

const isPathInsideTemplateEmbedding = (node: SyntaxNode): boolean => {
    if (node.type !== 'string' || !node.parent) {
        return false;
    }

    const isInsideStatement = templateUsingStatements.includes(
        node.parent.type,
    );

    if (isInsideStatement) {
        return true;
    }

    const isInsideFunctionCall =
        node.parent?.type === 'arguments' &&
        templateUsingFunctions.some((func) =>
            isFunctionCall(node.parent!.parent, func),
        );

    return isInsideFunctionCall;
};

const isIdentifierOf = (type: 'block' | 'macro', node: SyntaxNode): boolean => {
    if (!node.parent || node.parent.type !== type) {
        return false;
    }

    return node.type === 'identifier';
};

export class DefinitionProvider {
    server: Server;

    templateMappings: TemplatePathMapping[] = [];

    constructor(server: Server) {
        this.server = server;

        this.server.connection.onDefinition(this.onDefinition.bind(this));
    }

    async onDefinition(
        params: DefinitionParams,
    ): Promise<Definition | undefined> {
        const document = this.server.documentCache.get(params.textDocument.uri);

        if (!document) {
            return;
        }

        const cursorNode = findNodeByPosition(
            document.tree.rootNode,
            params.position,
        );

        if (!cursorNode) {
            return;
        }

        if (isPathInsideTemplateEmbedding(cursorNode)) {
            const templateUri = await this.resolveTemplateUri(
                getStringNodeValue(cursorNode),
            );

            if (!templateUri) return;

            return this.resolveTemplateDefinition(templateUri);
        }

        if (isIdentifierOf('block', cursorNode)) {
            const blockName = cursorNode.text;

            let extendedDocument: Document | undefined =
                await this.getExtendedTemplate(document);
            while (extendedDocument) {
                await extendedDocument.ensureParsed();
                const symbol = extendedDocument.getSymbolByName(
                    blockName,
                    'block',
                );
                if (!symbol) {
                    extendedDocument = await this.getExtendedTemplate(
                        extendedDocument,
                    );
                    continue;
                }

                return {
                    uri: extendedDocument.uri,
                    range: symbol.nameRange,
                };
            }

            return;
        }

        if (cursorNode.type === 'variable') {
            const cursorPosition = pointToPosition(cursorNode.startPosition);
            const blocks = document.locals.block.filter((x) =>
                rangeContainsPosition(x.range, cursorPosition),
            );
            const macroses = document.locals.macro.filter((x) =>
                rangeContainsPosition(x.range, cursorPosition),
            );

            const scopedVariables = [...macroses, ...blocks].flatMap(
                (x) => x.symbols.variable,
            );

            const symbol = [
                ...scopedVariables,
                ...macroses.flatMap((x) => x.args),
                ...document.locals.variable,
            ].find((x) => x.name === cursorNode.text);

            if (!symbol) return;

            return {
                uri: document.uri,
                range: symbol.nameRange,
            };
        }
    }

    async resolveTemplateUri(includeArgument: string): Promise<DocumentUri | undefined> {
        const workspaceFolderDirectory = documentUriToFsPath(this.server.workspaceFolder.uri);

        for (const { namespace, directory } of this.templateMappings) {
            if (!includeArgument.startsWith(namespace)) {
                continue;
            }

            const includePath = namespace === ''
                ? path.join(directory, includeArgument)
                : includeArgument.replace(namespace, directory);

            const pathToTwig = path.resolve(workspaceFolderDirectory, includePath);

            const stats = await fileStat(pathToTwig);
            if (stats) {
                return toDocumentUri(pathToTwig);
            }
        }

        return undefined;
    }

    private async getExtendedTemplate(document: Document) {
        if (!document.locals.extends) {
            return undefined;
        }

        const templateUri = await this.resolveTemplateUri(document.locals.extends);

        if (!templateUri) {
            return undefined;
        }

        return this.server.documentCache.get(templateUri);
    }

    resolveTemplateDefinition(templatePath: string): Definition | undefined {
        const document = this.server.documentCache.get(templatePath);

        if (!document) {
            return;
        }

        return {
            uri: document.uri,
            range: Range.create(0, 0, 0, 0),
        };
    }
}
