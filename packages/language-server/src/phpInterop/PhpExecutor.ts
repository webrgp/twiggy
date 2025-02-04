import { PhpUtilPath } from '../twigEnvironment/PhpUtilPath';
import { execPromisified, isProcessError } from '../utils/exec';
import { ReflectedType } from './ReflectedType';

export class PhpExecutor {
    constructor(
        private readonly _phpExecutable: string | undefined,
        private readonly _workspaceDirectory: string,
    ) {
        if (!this._phpExecutable) {
            console.warn('`twiggy.phpExecutable` is not configured. Some features will be disabled.');
        }
    }

    async call<TResult>(command: string, args: string[]): Promise<TResult | null> {
        if (!this._phpExecutable) {
            return null;
        }

        try {
            const result = await execPromisified(
                `${this._phpExecutable} ${command} ${args.join(' ')}`,
                { cwd: this._workspaceDirectory },
            );

            return JSON.parse(result.stdout) as TResult;
        } catch (error) {
            console.error((error as Error).message);

            if (isProcessError(error)) {
                console.error(error.stdout + error.stderr);
            }

            return null;
        }
    }

    async getClassDefinition(className: string) {
        return await this.call<{ path: string | null }>(PhpUtilPath.getDefinitionPhp, [
            this._workspaceDirectory,
            `'${className}'`,
        ]);
    }

    async getClassCompletion(className: string) {
        return await this.call<string[]>(PhpUtilPath.getCompletionPhp, [
            this._workspaceDirectory,
            `'${className}'`,
        ]) || [];
    }


    async completeInstanceProperties(className: string) {
        return await this.call<ReflectedType>(PhpUtilPath.completeInstanceProperties, [
            this._workspaceDirectory,
            `'${className}'`,
        ]);
    }
}
