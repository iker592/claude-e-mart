# Project Guidelines

Universal instructions for AI coding assistants (Claude, Cursor, Copilot, Windsurf, Cline).

## Code Style
- Use clear, descriptive variable names
- Keep functions small and focused
- Add comments only when the logic isn't self-evident
- Follow existing patterns in the codebase

## Git Workflow
- Create feature branches for changes
- Write clear commit messages explaining "why" not just "what"
- Open PRs for review before merging to main
- Keep commits atomic and focused

## Before Committing
- Run tests if available
- Check for linting errors
- Verify the build passes

## Security
- Never commit secrets, API keys, or credentials
- Validate user input at system boundaries
- Be cautious with shell commands and file operations

## Communication
- Be concise and direct
- Ask clarifying questions when requirements are ambiguous
- Explain trade-offs when multiple approaches exist
