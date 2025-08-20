You are currently in an empty repository called "slack-knowledge-agent".
Our goal is to create a service that will use the various Slack APIs in order to provide answers based on the data in the various Slack channels.

The project will be written in NodeJS, Typescript, using latest versions and popular libraries, implementing best architecture and software engineering practices.

We want to:
1. Support interacting with slack via the popular, best practice methods.

2. Support receiving additional data about the slack workspace, various channels, etc in a structured way via a JSON file config.
The extra info about about channels will be sent to the LLM only when relevant.

3. Expose a beautifule web interface (VITE + Typescript + React + Shadcn + Tanstack Quey + Zod +  Any other popular and relevant library).
The web interface will allow to select relevant channels and ask questions.
The questions will be passed to an LLM (We will support multiple, using popular libraries and best practices. The default one will be OpenAI).

4. The LLM will be given tools to use, which will allow him to access the slack API and query it.

5. We will support acting as a slack app via webhooks, and we will reply in the channel/thread to the questions