#!/usr/bin/env npx ts-node
/**
 * Basic Claude Agent SDK example (TypeScript).
 *
 * Usage:
 *   npm install @anthropic-ai/claude-agent-sdk
 *   export ANTHROPIC_API_KEY=your-api-key
 *   npx ts-node basic_agent.ts "Your prompt here"
 */

import { query } from "@anthropic-ai/claude-agent-sdk";

async function main() {
  const prompt = process.argv[2] || "What files are in this directory?";

  for await (const message of query({
    prompt,
    options: {
      allowedTools: ["Read", "Glob", "Grep", "Bash"],
    },
  })) {
    if ("result" in message) {
      console.log(message.result);
    } else if ("content" in message) {
      console.log(message.content);
    }
  }
}

main();
