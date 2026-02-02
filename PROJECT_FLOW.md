# OfficeGPT Project Flow 🔄

## File Responsibilities

### **What Happened to Old Files?**

| Old File  | What It Did                     | Now Handled By                       |
| --------- | ------------------------------- | ------------------------------------ |
| `chat.js` | CLI chat interface for terminal | `server.js` → `/api/chat` endpoint   |
| `rag.js`  | Test file to index documents    | `server.js` → `/api/upload` endpoint |

---

## Current Project Flow

### 📁 **Core Files (3 files only!)**

```
server.js    → Web server + API endpoints (handles upload & chat)
prepare.js   → PDF processing + embeddings (called by server.js)
public/      → Frontend UI (HTML/CSS/JS)
```

---

## 🔄 Complete Application Flow

### **PHASE 1: User Uploads PDF**

```
┌────────────────────────────────────────────────────────────┐
│ 1. USER ACTION (Frontend)                                  │
│    File: public/index.html + public/script.js              │
│    - User drags & drops PDF or clicks upload              │
│    - JavaScript creates FormData with PDF file            │
│    - Sends POST request to /api/upload                    │
└────────────────┬───────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────────┐
│ 2. SERVER RECEIVES REQUEST (Backend)                       │
│    File: server.js (Line 60-88)                           │
│                                                            │
│    app.post('/api/upload', upload.single('pdf'), ...)     │
│    - Multer saves PDF to uploads/ folder                  │
│    - Gets file path                                        │
└────────────────┬───────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────────┐
│ 3. CALL INDEXING FUNCTION                                  │
│    File: server.js → prepare.js                           │
│                                                            │
│    await indexTheDocument(filePath)                        │
│    - Calls function from prepare.js                        │
└────────────────┬───────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────────┐
│ 4. PROCESS PDF (prepare.js)                               │
│    File: prepare.js (Line 24-90)                          │
│                                                            │
│    a) Load PDF with PDFLoader                             │
│    b) Split into 500-char chunks (RecursiveTextSplitter) │
│    c) Generate embeddings (Google Gemini)                 │
│    d) Convert embeddings to arrays                         │
│    e) Upload to Pinecone vector database                   │
└────────────────┬───────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────────┐
│ 5. CLEANUP & RESPONSE (server.js)                         │
│    File: server.js (Line 73-76)                           │
│                                                            │
│    - Delete local PDF file (no longer needed)             │
│    - Send success response to frontend                     │
│    - Frontend shows success message                        │
└────────────────────────────────────────────────────────────┘
```

### **PHASE 2: User Asks Question**

```
┌────────────────────────────────────────────────────────────┐
│ 1. USER TYPES QUESTION (Frontend)                         │
│    File: public/script.js (Line 94-102)                   │
│    - User types: "How many sick leaves do I get?"         │
│    - JavaScript sends POST to /api/chat                    │
│    - Body: { message: "How many sick leaves..." }         │
└────────────────┬───────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────────┐
│ 2. SERVER RECEIVES CHAT REQUEST                           │
│    File: server.js (Line 92-150)                          │
│                                                            │
│    app.post('/api/chat', async (req, res) => {...})       │
│    - Gets user question from request body                  │
└────────────────┬───────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────────┐
│ 3. SEARCH VECTOR DATABASE                                 │
│    File: server.js (Line 104-105)                         │
│    Uses: prepare.js → vectorStore (exported)              │
│                                                            │
│    const chunks = await vectorStore.similaritySearch(     │
│        question, 3                                         │
│    )                                                       │
│    - Converts question to embedding                        │
│    - Finds 3 most similar chunks in Pinecone              │
│    - Returns relevant text chunks                          │
└────────────────┬───────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────────┐
│ 4. PREPARE CONTEXT FOR AI                                 │
│    File: server.js (Line 106-124)                         │
│                                                            │
│    - Combines 3 chunks into single context string        │
│    - Creates system prompt for AI                         │
│    - Adds user question + context                         │
└────────────────┬───────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────────┐
│ 5. SEND TO GROQ AI                                        │
│    File: server.js (Line 126-141)                         │
│                                                            │
│    const completion = await groq.chat.completions.create({ │
│        model: 'llama-3.3-70b-versatile',                  │
│        messages: [system_prompt, user_query]              │
│    })                                                      │
│    - AI reads context and generates answer                 │
└────────────────┬───────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────────┐
│ 6. RETURN ANSWER TO USER                                  │
│    File: server.js → public/script.js                     │
│                                                            │
│    - Server sends JSON: { response: "You get 6..." }     │
│    - Frontend displays in chat bubble                      │
└────────────────────────────────────────────────────────────┘
```

---

## 📝 Detailed File Breakdown

### **1. server.js** (Main Controller)

```javascript
// OLD: chat.js did CLI chat → NOW: /api/chat endpoint does web chat
// OLD: rag.js did indexing → NOW: /api/upload endpoint does indexing

Lines 1-19:   Import dependencies
Lines 20-50:  Setup Express, Multer, uploads folder
Lines 51-58:  Initialize Groq AI client

Lines 60-88:  POST /api/upload
              ├── Receive PDF file
              ├── Call prepare.js → indexTheDocument()
              ├── Delete local PDF
              └── Return success

Lines 90-150: POST /api/chat
              ├── Receive user question
              ├── Search vectorStore (from prepare.js)
              ├── Get relevant chunks
              ├── Send to Groq AI
              └── Return answer

Lines 152-157: Health check endpoint
Lines 159-162: Start server on port 3000
```

### **2. prepare.js** (PDF Processor)

```javascript
// Called by server.js for both upload and chat

Lines 1-6:    Import libraries (PDF, Gemini, Pinecone)
Lines 8-10:   Initialize Google Gemini embeddings
Lines 12-16:  Initialize Pinecone client
Lines 18-22:  Create vectorStore (exported to server.js)

Lines 24-90:  indexTheDocument(filePath)
              ├── Load PDF file
              ├── Split into chunks
              ├── Generate embeddings (Gemini)
              ├── Convert to arrays
              ├── Flatten metadata
              └── Upload to Pinecone

EXPORTS:
- vectorStore → Used by server.js for searching
- indexTheDocument() → Called by server.js /api/upload
```

### **3. public/script.js** (Frontend)

```javascript
// Handles all user interactions

Lines 1-6:    API URL configuration
Lines 8-13:   Get DOM elements
Lines 15-32:  Drag & drop handlers
Lines 34-65:  handleFileUpload()
              └── Sends PDF to /api/upload

Lines 67-78:  showUploadStatus()
Lines 80-92:  Enter key listener

Lines 94-146: sendMessage()
              ├── Send question to /api/chat
              ├── Show loading animation
              ├── Display AI response
              └── Handle errors

Lines 148-165: addMessage() - Add chat bubbles
Lines 167-171: removeMessage() - Remove loading
Lines 173-177: Auto-resize textarea
```

---

## 🔄 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    OfficeGPT System                          │
└─────────────────────────────────────────────────────────────┘

UPLOAD FLOW:
User Browser → public/script.js → server.js → prepare.js → Gemini API
                                       ↓
                                  Pinecone DB ← Delete local PDF

CHAT FLOW:
User Browser → public/script.js → server.js → prepare.js (vectorStore)
                                       ↓           ↓
                                   Pinecone ← Search similar chunks
                                       ↓
                                   Groq AI ← Question + Context
                                       ↓
                                   Response → User Browser
```

---

## 🎯 Key Changes from Old Structure

### Before (3 separate files):

```
chat.js     → Terminal-based chat (CLI)
rag.js      → Test script to index one PDF
prepare.js  → PDF processing functions
```

### After (Integrated into server.js):

```
server.js   → Web server with:
              - /api/upload (replaced rag.js)
              - /api/chat (replaced chat.js)
              - Uses prepare.js functions

prepare.js  → Same functions, now called by server.js
public/     → Web UI instead of CLI
```

---

## 🔧 How Each Component Works

### **Multer (File Upload)**

```javascript
// In server.js
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: "document-<timestamp>.pdf",
});
```

- Temporarily saves PDF to disk
- Provides file path to processing function
- File deleted after processing

### **Vector Store (Persistent Memory)**

```javascript
// In prepare.js
export const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
  pineconeIndex,
});
```

- Connects to Pinecone cloud database
- Exported for use in server.js
- Used for similarity search during chat

### **Embeddings (Text → Numbers)**

```javascript
// In prepare.js
const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "text-embedding-004",
});
```

- Converts text to 768-dimensional vectors
- Used for both indexing and searching
- Free tier from Google

### **LLM (Answer Generation)**

```javascript
// In server.js
const completion = await groq.chat.completions.create({
  model: "llama-3.3-70b-versatile",
  messages: [systemPrompt, userQuery],
});
```

- Takes context + question
- Generates natural language answer
- Fast and free through Groq

---

## 📊 API Endpoints Summary

| Endpoint      | Method | Purpose             | Called By  |
| ------------- | ------ | ------------------- | ---------- |
| `/`           | GET    | Serve HTML page     | Browser    |
| `/api/upload` | POST   | Upload & index PDF  | Frontend   |
| `/api/chat`   | POST   | Answer questions    | Frontend   |
| `/api/health` | GET    | Check server status | Monitoring |

---

## 🚀 Execution Order

### **Server Startup:**

```
1. server.js runs
   ↓
2. Imports prepare.js
   ↓
3. prepare.js initializes:
   - Gemini embeddings
   - Pinecone connection
   - Creates vectorStore
   ↓
4. Server starts on port 3000
   ↓
5. Ready to receive requests!
```

### **User Upload:**

```
1. User selects PDF
   ↓
2. Frontend sends to /api/upload
   ↓
3. server.js receives file
   ↓
4. Calls prepare.js → indexTheDocument()
   ↓
5. PDF processed and stored in Pinecone
   ↓
6. Local file deleted
   ↓
7. Success message to user
```

### **User Chat:**

```
1. User types question
   ↓
2. Frontend sends to /api/chat
   ↓
3. server.js searches vectorStore
   ↓
4. Gets 3 relevant chunks
   ↓
5. Sends to Groq AI with context
   ↓
6. AI generates answer
   ↓
7. Answer displayed to user
```

---

## 💡 Why This Structure?

**Benefits:**

- ✅ **Single server file** - Easy to deploy
- ✅ **Web interface** - Better UX than CLI
- ✅ **Separated concerns** - prepare.js only handles PDF processing
- ✅ **Reusable functions** - prepare.js exports for server.js
- ✅ **RESTful API** - Standard web architecture
- ✅ **No redundancy** - No need for separate test files

**The old structure:**

- ❌ chat.js only worked in terminal
- ❌ rag.js was just a test file
- ❌ Couldn't serve web interface

**The new structure:**

- ✅ Everything accessible via web browser
- ✅ One unified server handling all requests
- ✅ Professional API structure
- ✅ Production-ready

---

Made with ❤️ - Now you understand the complete flow!
