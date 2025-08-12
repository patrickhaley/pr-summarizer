import * as core from '@actions/core';
import * as github from '@actions/github';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

interface FileChange {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

async function run(): Promise<void> {
  try {
    // Get inputs
    const githubToken = core.getInput('github-token', { required: true });
    const openaiApiKey = core.getInput('openai-api-key');
    const anthropicApiKey = core.getInput('anthropic-api-key');
    const modelProvider = core.getInput('model-provider');
    const model = core.getInput('model');

    // Initialize GitHub client
    const octokit = github.getOctokit(githubToken);
    const context = github.context;

    if (!context.payload.pull_request) {
      throw new Error('This action can only be run on pull request events');
    }

    // Get PR details
    const prNumber = context.payload.pull_request.number;
    const owner = context.repo.owner;
    const repo = context.repo.repo;

    // Fetch PR files
    const { data: files } = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber,
    });

    // Get PR diff summary
    const changes: FileChange[] = files.map(file => ({
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      patch: file.patch
    }));

    const prompt = `Please generate a clear and concise pull request description based on the following changes. Format the description in an unordered list so it's easy for an engineer to read. And do not add an introctory paragraph.\n\n${JSON.stringify(changes, null, 2)}`;

    // Generate description using AI
    let description: string;
    if (modelProvider === 'anthropic' && anthropicApiKey) {
      const anthropic = new Anthropic({ apiKey: anthropicApiKey });
      const response = await anthropic.messages.create({
        model: model || 'claude-3-5-sonnet-20241022',
        system: "You are a helpful assistant that creates clear and concise pull request descriptions.",
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });
      
      if (!response.content) {
        throw new Error('Unexpected response format from Anthropic API');
      }
      description = response.content.map(block => block.text).join('');
    } else if (openaiApiKey) {
      const openai = new OpenAI({ apiKey: openaiApiKey });
      const response = await openai.chat.completions.create({
        model: model || 'gpt-4',
        messages: [{
          role: 'user',
          content: prompt
        }]
      });
      
      if (!response.choices?.[0]?.message?.content) {
        throw new Error('Unexpected response format from OpenAI API');
      }
      description = response.choices[0].message.content;
    } else {
      throw new Error('Either OpenAI or Anthropic API key must be provided');
    }

    // Get existing PR description
    const { data: pr } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });

    // Create a header for the AI-generated description
    const aiHeader = `\n\n## 🤖 AI Summary\n\n`;
    const aiDescription = aiHeader + description;

    // Update PR description
    const existingBody = pr.body || '';
    core.info(`Existing PR description: ${existingBody ? 'present' : 'empty'}`);
    
    // Check if there's already an AI-generated section and replace it
    const aiSectionRegex = /\n\n## 🤖 AI Summary\n\n[\s\S]*?(?=\n\n##|$)/;
    const hasExistingAiSection = existingBody.includes('## 🤖 AI Summary');
    core.info(`Existing AI section: ${hasExistingAiSection ? 'found' : 'not found'}`);

    const updatedBody = hasExistingAiSection
      ? existingBody.replace(aiSectionRegex, aiDescription)
      : existingBody + aiDescription;

    core.info(`Attempting to ${hasExistingAiSection ? 'update' : 'append'} PR description...`);
    
    const updateResponse = await octokit.rest.pulls.update({
      owner,
      repo,
      pull_number: prNumber,
      body: updatedBody
    });
    
    if (updateResponse.status === 200) {
      core.info(`GitHub API update successful (Status: ${updateResponse.status})`);
      core.info(`Updated PR description length: ${updateResponse.data.body?.length || 0} characters`);
      core.info(`PR description ${hasExistingAiSection ? 'updated with new' : 'appended with new'} AI-generated content`);
    } else {
      core.warning(`GitHub API update returned unexpected status: ${updateResponse.status}`);
    }
    
    core.info('Successfully updated PR description');
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unexpected error occurred');
    }
  }
}

run();
