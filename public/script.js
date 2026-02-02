// Configuration
const API_BASE_URL = window.location.origin.includes("5500")
  ? "http://localhost:3000" // If accessed via Live Server, point to Express server
  : ""; // If accessed via Express server, use relative URLs

// File upload handling
const fileInput = document.getElementById("fileInput");
const uploadArea = document.getElementById("uploadArea");
const uploadStatus = document.getElementById("uploadStatus");
const chatMessages = document.getElementById("chatMessages");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const chooseFileBtn = document.getElementById("chooseFileBtn");

// Drag and drop
uploadArea.addEventListener("click", (e) => {
  // Only trigger if not clicking the button itself
  if (e.target !== chooseFileBtn && !chooseFileBtn.contains(e.target)) {
    fileInput.click();
  }
});

// Button click handler
chooseFileBtn.addEventListener("click", (e) => {
  e.stopPropagation(); // Prevent uploadArea click
  fileInput.click();
});

uploadArea.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadArea.classList.add("dragover");
});

uploadArea.addEventListener("dragleave", () => {
  uploadArea.classList.remove("dragover");
});

uploadArea.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadArea.classList.remove("dragover");
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    handleFileUpload(files[0]);
  }
});

fileInput.addEventListener("change", (e) => {
  if (e.target.files.length > 0) {
    handleFileUpload(e.target.files[0]);
    // Reset input so same file can be uploaded again
    e.target.value = "";
  }
});

async function handleFileUpload(file) {
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    showUploadStatus("Only PDF files are allowed!", "error");
    return;
  }

  const formData = new FormData();
  formData.append("pdf", file);

  showUploadStatus(
    `Uploading ${file.name}<span class="loading-dots"></span>`,
    "loading",
  );

  try {
    const response = await fetch(`${API_BASE_URL}/api/upload`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (response.ok) {
      showUploadStatus(
        `✓ ${file.name} uploaded and indexed successfully!`,
        "success",
      );
      addMessage(
        "assistant",
        `Great! I've processed "${file.name}". You can now ask me questions about it.`,
      );
    } else {
      showUploadStatus(`✗ Error: ${data.error}`, "error");
    }
  } catch (error) {
    showUploadStatus(`✗ Upload failed: ${error.message}`, "error");
  }
}

function showUploadStatus(message, type) {
  uploadStatus.innerHTML = message;
  uploadStatus.className = `upload-status ${type}`;
}

// Chat handling
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

async function sendMessage() {
  const message = userInput.value.trim();
  if (!message) return;

  // Add user message
  addMessage("user", message);
  userInput.value = "";

  // Disable input while processing
  userInput.disabled = true;
  sendBtn.disabled = true;

  // Add loading message
  const loadingId = Date.now();
  addMessage(
    "assistant",
    'Thinking<span class="loading-dots"></span>',
    loadingId,
  );

  try {
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    });

    const data = await response.json();

    // Remove loading message
    removeMessage(loadingId);

    if (response.ok) {
      addMessage("assistant", data.response);
    } else {
      addMessage("assistant", `Sorry, I encountered an error: ${data.error}`);
    }
  } catch (error) {
    removeMessage(loadingId);
    addMessage(
      "assistant",
      `Sorry, I couldn't process your message: ${error.message}`,
    );
  } finally {
    userInput.disabled = false;
    sendBtn.disabled = false;
    userInput.focus();
  }
}

function addMessage(type, content, id = null) {
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${type}`;
  if (id) messageDiv.dataset.id = id;

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = type === "user" ? "👤" : "🤖";

  const contentDiv = document.createElement("div");
  contentDiv.className = "message-content";
  contentDiv.innerHTML = `<p>${content}</p>`;

  messageDiv.appendChild(avatar);
  messageDiv.appendChild(contentDiv);
  chatMessages.appendChild(messageDiv);

  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeMessage(id) {
  const message = chatMessages.querySelector(`[data-id="${id}"]`);
  if (message) message.remove();
}

// Auto-resize textarea
userInput.addEventListener("input", function () {
  this.style.height = "auto";
  this.style.height = Math.min(this.scrollHeight, 120) + "px";
});

// Initial focus
userInput.focus();
