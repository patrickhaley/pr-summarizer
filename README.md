# PR Summarizer

A GitHub Action that automatically generates pull request descriptions using AI (OpenAI or Anthropic). This action analyzes the changes in your pull request and creates a clear, concise description that helps other engineers understand the changes.

## Features

- Automatically generates PR descriptions using AI
- Supports both OpenAI (GPT-4) and Anthropic (Claude) models
- Preserves existing PR descriptions and appends AI-generated summaries
- Automatically updates AI summaries on subsequent runs
- Easy to configure and customize
- Clear headers for AI-generated content

## Behavior

When the action runs:
1. If there's no existing PR description, it creates one with an AI-generated summary
2. If there's an existing description:
   - Preserves the original content
   - Appends or updates the AI-generated summary
   - Clearly marks AI-generated content with "🤖 PR Summarizer" header

## Usage

Add this action to your workflow file (e.g., `.github/workflows/pr-description.yml`):

```yaml
name: Generate PR Description
on:
  pull_request:
    types: [opened]

permissions:
  pull-requests: write
  contents: read

jobs:
  generate-description:
    runs-on: ubuntu-latest
    steps:
      - uses: meido-ai/pr-summarizer@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
          model-provider: 'anthropic'
          model: 'claude-3-5-sonnet-20241022'
          # Optional: Use OpenAI instead
          # openai-api-key: ${{ secrets.OPENAI_API_KEY }}
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `github-token` | GitHub token for API access | Yes | N/A |
| `openai-api-key` | OpenAI API key | Yes† | N/A |
| `anthropic-api-key` | Anthropic API key | No‡ | N/A |
| `model-provider` | AI model provider to use (`openai` or `anthropic`) | No | `openai` |
| `model` | Model to use (e.g., `gpt-4` for OpenAI or `claude-3-sonnet-20240229` for Anthropic) | No | `gpt-4` |

† OpenAI API key is required unless using Anthropic (see note below)  
‡ Anthropic API key is required if `model-provider` is set to `anthropic`

**Note on API Keys:**
- You must provide either an OpenAI API key or an Anthropic API key
- By default, OpenAI will be used and requires an OpenAI API key
- To use Anthropic:
  1. Set `model-provider` to `anthropic`
  2. Provide an `anthropic-api-key`
  3. Optionally remove the `openai-api-key`

## Setup

1. Add the workflow file to your repository
2. Set up the required secrets in your repository:
   - For OpenAI: Add `OPENAI_API_KEY` secret
   - For Anthropic: Add `ANTHROPIC_API_KEY` secret
3. The action will run automatically when PRs are opened

## Development

To modify or contribute to this action:

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Make your changes
4. Build the action:
   ```bash
   npm run build
   ```
5. Test your changes:
   ```bash
   npm test
   ```
