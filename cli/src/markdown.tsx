import React from "react";
import { Text, Box } from "ink";
import chalk from "chalk";
import { marked } from "marked";

// Render markdown tokens to styled text using chalk
function renderTokens(tokens: marked.Token[]): string {
  let result = "";

  for (const token of tokens) {
    switch (token.type) {
      case "heading":
        const headingText = renderInline(token.tokens || []);
        if (token.depth === 1) {
          result += chalk.cyan.bold(headingText) + "\n";
        } else if (token.depth === 2) {
          result += chalk.magenta.bold(headingText) + "\n";
        } else {
          result += chalk.yellow.bold(headingText) + "\n";
        }
        break;

      case "paragraph":
        result += renderInline(token.tokens || []) + "\n";
        break;

      case "code":
        if (token.lang) {
          result += chalk.gray(token.lang) + "\n";
        }
        result += token.text + "\n";
        break;

      case "list":
        for (let i = 0; i < token.items.length; i++) {
          const item = token.items[i];
          const bullet = token.ordered ? chalk.cyan(`${i + 1}.`) : chalk.cyan("•");
          const itemText = renderInline(item.tokens || []);
          result += `  ${bullet} ${itemText}\n`;
        }
        break;

      case "blockquote":
        const quoteText = renderTokens(token.tokens || []).trim();
        result += chalk.gray("│ " + quoteText.split("\n").join("\n│ ")) + "\n";
        break;

      case "space":
        result += "\n";
        break;

      case "hr":
        result += chalk.gray("─".repeat(40)) + "\n";
        break;

      default:
        // For any other token types, try to render text
        if ("text" in token && typeof token.text === "string") {
          result += token.text;
        }
    }
  }

  return result;
}

// Render inline tokens (bold, italic, code, links, etc.)
function renderInline(tokens: marked.Token[]): string {
  let result = "";

  for (const token of tokens) {
    switch (token.type) {
      case "text":
        result += token.text;
        break;

      case "strong":
        result += chalk.bold(renderInline(token.tokens || []));
        break;

      case "em":
        result += chalk.italic(renderInline(token.tokens || []));
        break;

      case "codespan":
        result += chalk.hex("#FF69B4")(token.text); // Pink for inline code
        break;

      case "link":
        result += chalk.cyan(token.text);
        break;

      case "br":
        result += "\n";
        break;

      default:
        if ("text" in token && typeof token.text === "string") {
          result += token.text;
        } else if ("tokens" in token && Array.isArray(token.tokens)) {
          result += renderInline(token.tokens);
        }
    }
  }

  return result;
}

function renderMarkdown(text: string): string {
  try {
    const tokens = marked.lexer(text);
    return renderTokens(tokens).trim();
  } catch {
    // Fallback to plain text if parsing fails
    return text;
  }
}

interface MarkdownTextProps {
  children: string;
}

export function MarkdownText({ children }: MarkdownTextProps) {
  const rendered = renderMarkdown(children);
  return (
    <Box>
      <Text>{rendered}</Text>
    </Box>
  );
}
