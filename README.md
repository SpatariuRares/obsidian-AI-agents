# AI Agents for Obsidian

Transform your Obsidian vault into an ecosystem of configurable AI agents defined entirely by Markdown files.

## Overview

AI Agents is an Obsidian plugin that allows you to create, manage, and interact with multiple AI assistants directly within your notes. Instead of generic AI chatbots, you can define custom agents with specific roles, system prompts, and tool permissions just by creating Markdown files in your vault.

## Features

- **Markdown-Defined Agents:** Create a new agent simply by creating a standard markdown file with specific properties.
- **Dedicated Chat Interface:** Interact with your agents through a fully integrated, modern chat view.
- **Vault Context:** Agents can read from your vault and analyze your notes.
- **Configurable Tools & Memory:** Control which agents have access to tools (e.g., file reading, workspace access) and manage their conversation memory.
- **Conversation Logging:** Save your valuable chats as markdown notes to keep an accessible history of your AI interactions.
- **Interrupt Generation:** Stop the LLM response generation at any point directly from the UI.
- **Example Generator:** Quickly bootstrap new agents with the built-in default agent generator.

## Setup & Configuration

1. Install the plugin and enable it in your Obsidian settings.
2. Complete the initial setup in the plugin settings by configuring your preferred default agent and settings.
3. Define the LLM model configurations and API keys as required.
4. Open the AI Agents chat view via the ribbon icon or command palette.

## Creating an Agent

You can create a new agent by adding a Markdown file to your designated agents folder. The agent's behavior is shaped by its properties (YAML frontmatter or Obsidian properties).

**Example Agent Definition:**

```yaml
---
name: Proofreader
description: An agent that helps proofread and edit markdown notes.
prompt: You are a strict editor. Review the text provided and suggest improvements for clarity, grammar, and tone.
tools: false
memory: true
---
# Proofreader Agent

This agent ensures my notes are perfectly written and formatted.
```

## Development

To build the plugin from source:

1. Clone the repository into your vault's `.obsidian/plugins/` directory.
2. Run `npm install` to install dependencies.
3. Run `npm run dev` to start compilation in watch mode.
4. Run `npm run build` for a production build.

## License

MIT License
