import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone as PineconeClient } from "@pinecone-database/pinecone";
import fs from "fs";
import path from "path";
import os from "os";

const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "text-embedding-004", // Free tier model
  apiKey: process.env.GOOGLE_API_KEY,
});

const pinecone = new PineconeClient({
  apiKey: process.env.PINECONE_API_KEY,
});

const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME);

export const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
  pineconeIndex,
  maxConcurrency: 5,
});

export async function indexTheDocument(filePathOrBuffer, originalName = "document.pdf") {
  let tempFilePath = null;

  try {
    // Handle both file path (local dev) and buffer (serverless)
    if (Buffer.isBuffer(filePathOrBuffer)) {
      // Create temp file from buffer for serverless environments
      const tempDir = os.tmpdir();
      tempFilePath = path.join(tempDir, `temp-${Date.now()}-${originalName}`);
      fs.writeFileSync(tempFilePath, filePathOrBuffer);
      console.log("Loading PDF from buffer:", originalName);
    } else {
      // Use provided file path (local development)
      tempFilePath = filePathOrBuffer;
      console.log("Loading PDF:", tempFilePath);
    }

    const loader = new PDFLoader(tempFilePath, { splitPages: false });
    const doc = await loader.load();

    if (!doc[0]?.pageContent || doc[0].pageContent.length === 0) {
      throw new Error("PDF content is empty or could not be extracted");
    }

    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 100,
    });

    const splitDocs = await textSplitter.splitDocuments(doc);
    console.log(`Processing ${splitDocs.length} document chunks...`);

    if (splitDocs.length === 0) {
      throw new Error("No documents to index after splitting");
    }

    const batchSize = 10;
    let totalIndexed = 0;

    for (let i = 0; i < splitDocs.length; i += batchSize) {
      const batch = splitDocs.slice(i, i + batchSize);

      // Generate embeddings
      const texts = batch.map((doc) => doc.pageContent);
      const vectors = await embeddings.embedDocuments(texts);

      // Convert vectors to arrays (Gemini returns objects with numeric keys)
      const vectorArrays = vectors.map((v) =>
        Array.isArray(v) ? v : Array.from(Object.values(v)),
      );

      // Prepare records for Pinecone
      const records = batch.map((doc, idx) => {
        // Flatten metadata - Pinecone only accepts string, number, boolean, or list of strings
        const flatMetadata = {
          text: doc.pageContent,
          source: originalName || doc.metadata.source || "document.pdf",
        };

        if (doc.metadata.pdf) {
          flatMetadata.totalPages = doc.metadata.pdf.totalPages || 0;
        }

        return {
          id: `doc_${i + idx}_${Date.now()}`,
          values: vectorArrays[idx],
          metadata: flatMetadata,
        };
      });

      await pineconeIndex.upsert(records);
      totalIndexed += records.length;
    }

    console.log("✓ Successfully indexed", splitDocs.length, "document chunks!");
  } catch (error) {
    console.error("❌ Error:", error.message);
    throw error;
  } finally {
    // Cleanup temp file if we created one from buffer
    if (Buffer.isBuffer(filePathOrBuffer) && tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      console.log("✓ Cleaned up temp file");
    }
  }
}
