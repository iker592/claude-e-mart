#!/usr/bin/env python3
"""
Basic Claude Agent SDK example.

Usage:
    pip install claude-agent-sdk
    export ANTHROPIC_API_KEY=your-api-key
    python basic_agent.py "Your prompt here"
"""

import asyncio
import sys
from claude_agent_sdk import query, ClaudeAgentOptions


async def main():
    prompt = sys.argv[1] if len(sys.argv) > 1 else "What files are in this directory?"

    async for message in query(
        prompt=prompt,
        options=ClaudeAgentOptions(
            allowed_tools=["Read", "Glob", "Grep", "Bash"]
        )
    ):
        if hasattr(message, "result"):
            print(message.result)
        elif hasattr(message, "content"):
            print(message.content)


if __name__ == "__main__":
    asyncio.run(main())
