import express from "express";
import multer from "multer";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import Groq from "groq-sdk";
import { indexTheDocument, vectorStore } from "./prepare.js";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "document-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() === ".pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed!"));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Initialize Groq
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Upload and index PDF
app.post("/api/upload", upload.single("pdf"), async (req, res) => {
  let filePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    filePath = req.file.path;
    console.log(`Processing uploaded file: ${req.file.originalname}`);

    // Index the document
    await indexTheDocument(filePath);

    // ✅ DELETE FILE AFTER PROCESSING - Important for deployment!
    // The document chunks are now safely stored in Pinecone (cloud)
    // No need to keep the local file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`✓ Cleaned up local file: ${req.file.originalname}`);
    }

    res.json({
      success: true,
      message: "PDF uploaded and indexed successfully",
      filename: req.file.originalname,
      chunks: "Document processed and added to knowledge base",
    });
  } catch (error) {
    console.error("Upload error:", error);

    // Cleanup file on error too
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`✓ Cleaned up file after error`);
    }

    res.status(500).json({
      error: "Failed to process PDF",
      details: error.message,
    });
  }
});

// Chat endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || message.trim() === "") {
      return res.status(400).json({ error: "Message is required" });
    }

    console.log(`User query: ${message}`);

    // Retrieve relevant chunks from vector store
    const relevantChunks = await vectorStore.similaritySearch(message, 3);
    const context = relevantChunks
      .map((chunk) => chunk.pageContent)
      .join("\n\n");

    const SYSTEM_PROMPT = `You are OfficeGPT, an intelligent assistant for office-related questions. 
Use the following relevant pieces of retrieved context to answer the question accurately. 
If you don't know the answer based on the context, politely say you don't have that information.
Be professional, concise, and helpful.`;

    const userQuery = `Question: ${message}
Relevant context: ${context}
Answer:`;

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: userQuery,
        },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 1024,
    });

    const response = completion.choices[0].message.content;
    console.log(`Assistant response: ${response}`);

    res.json({
      response: response,
      sources: relevantChunks.length,
    });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({
      error: "Failed to process message",
      details: error.message,
    });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", service: "OfficeGPT" });
});

app.listen(PORT, () => {
  console.log(`\n🚀 OfficeGPT Server running on http://localhost:${PORT}`);
  console.log(`📄 Open your browser and visit the URL above\n`);
});
