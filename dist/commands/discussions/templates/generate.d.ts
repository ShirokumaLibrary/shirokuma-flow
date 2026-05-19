import type { Logger } from "../../../utils/logger.js";
export declare function getAvailableLanguages(): string[];
export interface TemplatesOptions {
    verbose?: boolean;
    lang?: string;
    output?: string;
}
export declare function cmdGenerate(options: TemplatesOptions, logger: Logger): number;
export declare function cmdListLanguages(_options: TemplatesOptions, logger: Logger): number;
export declare function cmdAddLanguage(langCode: string, _options: TemplatesOptions, logger: Logger): number;
//# sourceMappingURL=generate.d.ts.map