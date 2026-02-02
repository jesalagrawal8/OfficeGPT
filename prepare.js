import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone as PineconeClient } from "@pinecone-database/pinecone";

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

export async function indexTheDocument(filePath) {
  console.log("Loading PDF:", filePath);
  const loader = new PDFLoader(filePath, { splitPages: false });
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

  try {
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
          source: doc.metadata.source || "",
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
  }
}
