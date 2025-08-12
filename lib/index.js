"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const openai_1 = __importDefault(require("openai"));
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
async function run() {
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
        const changes = files.map(file => ({
            filename: file.filename,
            status: file.status,
            additions: file.additions,
            deletions: file.deletions,
            patch: file.patch
        }));
        const prompt = `Please generate a clear and concise pull request description based on the following changes. Format the description in an unordered list so it's easy for an engineer to read. And do not add an introctory paragraph.\n\n${JSON.stringify(changes, null, 2)}`;
        // Generate description using AI
        let description;
        if (modelProvider === 'anthropic' && anthropicApiKey) {
            const anthropic = new sdk_1.default({ apiKey: anthropicApiKey });
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
        }
        else if (openaiApiKey) {
            const openai = new openai_1.default({ apiKey: openaiApiKey });
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
        }
        else {
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
        }
        else {
            core.warning(`GitHub API update returned unexpected status: ${updateResponse.status}`);
        }
        core.info('Successfully updated PR description');
    }
    catch (error) {
        if (error instanceof Error) {
            core.setFailed(error.message);
        }
        else {
            core.setFailed('An unexpected error occurred');
        }
    }
}
run();
