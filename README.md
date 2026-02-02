# OfficeGPT 🚀

AI-powered document assistant that lets you upload PDFs and chat with them using natural language.

## Quick Start

```bash
bun install
bun start
```

📖 **[Full Documentation](./DEPLOYMENT.md)** - Installation, deployment, and troubleshooting guide

## Features

- 📄 Upload & chat with PDF documents
- 🤖 AI-powered responses using RAG (Retrieval-Augmented Generation)
- 🔍 Semantic search with Google Gemini embeddings
- ⚡ Fast inference with Groq Llama 3.3
- 💾 Cloud vector storage with Pinecone

## Environment Setup

Create `.env` file:
```env
GOOGLE_API_KEY=your_google_api_key
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=your_index_name
GROQ_API_KEY=your_groq_api_key
```

## Tech Stack

- Runtime: Bun
- Backend: Express.js
- AI: Google Gemini + Groq Llama 3.3
- Vector DB: Pinecone
- Frontend: HTML/CSS/JS
]/**
 * Implementation plan
 * Stage 1: Indexting
 * 1. Load the document - pdf, text - completed
 * 2. Chunk the document - completed
 * 3. Generate vector embeddings - completed

 *
 * Stage 2: Using the chatbot
 * 1. Setup LLM 
 * 2. Add retrieval step
 * 3. Pass input + relevant information to LLM
 * 4. Congratulations
 */
Made with ❤️ by Jesal Agrawal
