import { DidChangeConfigurationNotification, DidChangeConfigurationParams } from 'vscode-languageserver';
import { Server } from '../server';
import { LanguageServerSettings } from './language-server-settings';
import { getTemplatePathMappingsFromSymfony } from '../utils/symfony/twigConfig';

export class ConfigurationManager {
    readonly configurationSection = 'twiggy';
    server: Server;

    constructor(server: Server) {
        this.server = server;

        this.server.connection.client.register(DidChangeConfigurationNotification.type, { section: this.configurationSection });
        this.server.connection.onDidChangeConfiguration(this.onDidChangeConfiguration.bind(this));
    }

    async onDidChangeConfiguration({ settings }: DidChangeConfigurationParams) {
        const config: LanguageServerSettings | undefined = settings?.[this.configurationSection];

        const phpBinConsoleCommand = config?.phpBinConsoleCommand?.trim();
        await this.server.completionProvider.initializeGlobalsFromCommand(phpBinConsoleCommand);

        const mappings = phpBinConsoleCommand
            ? await getTemplatePathMappingsFromSymfony(phpBinConsoleCommand)
            : [];

        this.server.completionProvider.templateMappings = mappings;
        this.server.definitionProvider.templateMappings = mappings;
    }
}
