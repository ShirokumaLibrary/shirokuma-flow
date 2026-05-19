import MarkdownIt from 'markdown-it';
/**
 * Parse markdown content and extract heading structure
 */
export function parseHeadings(content) {
    const md = new MarkdownIt();
    const tokens = md.parse(content, {});
    const headings = [];
    const stack = [];
    let currentLine = 1;
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token.type === 'heading_open') {
            const level = parseInt(token.tag.substring(1)); // h1 -> 1, h2 -> 2, etc.
            const contentToken = tokens[i + 1];
            const text = contentToken && contentToken.type === 'inline' ? contentToken.content : '';
            const heading = {
                level,
                text,
                startLine: token.map ? token.map[0] + 1 : currentLine,
                endLine: -1, // Will be set later
                children: [],
            };
            // Pop stack until we find a parent with lower level
            while (stack.length > 0 && stack[stack.length - 1].level >= level) {
                stack.pop();
            }
            if (stack.length === 0) {
                // Top-level heading
                headings.push(heading);
            }
            else {
                // Add as child to parent
                stack[stack.length - 1].children.push(heading);
            }
            stack.push(heading);
        }
        if (token.map) {
            currentLine = token.map[1] + 1;
        }
    }
    // Calculate end lines for all headings
    const contentLines = content.split('\n');
    calculateEndLines(headings, contentLines.length);
    return headings;
}
/**
 * Calculate end lines for headings recursively
 */
function calculateEndLines(headings, totalLines) {
    for (let i = 0; i < headings.length; i++) {
        const heading = headings[i];
        // End line is either the start of next sibling or parent's end
        if (i < headings.length - 1) {
            heading.endLine = headings[i + 1].startLine - 1;
        }
        else {
            heading.endLine = totalLines;
        }
        // Recursively calculate for children
        if (heading.children.length > 0) {
            calculateEndLines(heading.children, heading.endLine);
        }
    }
}
/**
 * Count total number of headings
 */
export function countHeadings(headings) {
    let count = headings.length;
    for (const heading of headings) {
        count += countHeadings(heading.children);
    }
    return count;
}
/**
 * Get all headings as flat list
 */
export function flattenHeadings(headings) {
    const result = [];
    for (const heading of headings) {
        result.push(heading);
        result.push(...flattenHeadings(heading.children));
    }
    return result;
}
/**
 * Count lines in content
 */
export function countLines(content) {
    return content.split('\n').length;
}
//# sourceMappingURL=markdown.js.map