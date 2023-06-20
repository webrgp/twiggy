import { URI } from 'vscode-uri';
import { Server } from './server';
import readDir from './utils/read-dir';
import { parseTwig } from './utils/parse-twig';
import { readFile } from 'fs/promises';
import { DocumentUri } from 'vscode-languageserver';
import { fsPathToDocumentUri } from './utils/fs-path-to-document-uri';

class Document {
  filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async getText() {
    return await readFile(this.filePath, 'utf-8');
  }

  async cst() {
    const text = await this.getText();

    return await parseTwig(text);
  }
}

export class DocumentCache {
  server: Server;
  documents: Map<DocumentUri, Document> = new Map();

  constructor(server: Server) {
    this.server = server;

    this.initDocuments();
  }

  async initDocuments() {
    const iterator = readDir(URI.parse(this.server.workspaceFolder.uri).fsPath);
    const reIsTwig = /.twig$/i;

    for await (const filePath of iterator) {
      if (reIsTwig.test(filePath)) {
        this.documents.set(
          fsPathToDocumentUri(filePath),
          new Document(filePath)
        );
      }
    }
  }

  getDocument(documentUri: DocumentUri) {
    return this.documents.get(documentUri);
  }
}
