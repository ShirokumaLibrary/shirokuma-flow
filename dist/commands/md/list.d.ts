import { ListFormat } from '../../generators/md/lister.js';
interface ListOptions {
    config?: string;
    format?: ListFormat;
    output?: string;
    layer?: string;
    type?: string;
    category?: string;
    include?: string;
    groupBy?: 'layer' | 'type' | 'category' | 'none';
    sortBy?: 'path' | 'layer' | 'title';
    verbose?: boolean;
}
export declare function listCommand(options: ListOptions): Promise<number>;
export {};
//# sourceMappingURL=list.d.ts.map