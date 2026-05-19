import { countTokens } from 'gpt-tokenizer/model/gpt-4';
/**
 * Estimate token count for text using gpt-tokenizer
 */
export function estimateTokens(text) {
    try {
        return countTokens(text);
    }
    catch {
        // Fallback to approximate calculation if gpt-tokenizer fails
        // Rough estimate: ~4 characters per token
        return Math.ceil(text.length / 4);
    }
}
/**
 * Format token count for display
 */
export function formatTokenCount(count) {
    if (count < 1000) {
        return `${count}`;
    }
    if (count < 1000000) {
        return `${(count / 1000).toFixed(1)}K`;
    }
    return `${(count / 1000000).toFixed(2)}M`;
}
//# sourceMappingURL=tokens.js.map