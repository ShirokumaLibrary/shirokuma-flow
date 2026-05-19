/**
 * API Tools documentation generator
 *
 * Parses MCP Tool[] definitions and generates documentation.
 * Supports apps/mcp/src/tools/*.ts structure.
 */
/**
 * MCP Tool parameter definition
 */
export interface ApiToolParam {
    name: string;
    type: string;
    description: string;
    required: boolean;
    default?: unknown;
}
/**
 * MCP Tool annotation data from JSDoc
 */
export interface ApiToolAnnotation {
    feature?: string;
    dbTables?: string[];
    authLevel?: "none" | "authenticated" | "member" | "admin";
    relatedTests?: string;
}
/**
 * Test case linked to MCP tool
 */
export interface ApiToolTest {
    testdoc: string;
    target: string;
    feature?: string;
    file: string;
}
/**
 * HTTP Method type for Swagger-style display
 */
export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
/**
 * MCP Tool definition
 */
export interface ApiToolDef {
    name: string;
    description: string;
    params: ApiToolParam[];
    sourceFile: string;
    app: string;
    category: string;
    feature?: string;
    dbTables?: string[];
    authLevel?: string;
    relatedTests?: string;
    tests?: ApiToolTest[];
    testCoverage?: {
        hasTest: boolean;
        totalTests: number;
        coverageScore: number;
    };
    httpMethod?: HttpMethod;
}
/**
 * API Tools output structure
 */
export interface ApiToolsOutput {
    generatedAt: string;
    projectPath: string;
    tools: ApiToolDef[];
    categories: string[];
    apps: string[];
}
/**
 * API Tools command options
 */
export interface ApiToolsOptions {
    projectPath: string;
    configPath?: string;
    outputDir?: string;
}
/**
 * Run API Tools documentation generator
 */
export declare function runApiTools(options: ApiToolsOptions): Promise<number>;
//# sourceMappingURL=api-tools.d.ts.map