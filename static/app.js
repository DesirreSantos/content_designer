const SUGGESTIONS = [
    {
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`,
        text: "Criar post para Instagram com copy e hashtags"
    },
    {
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
        text: "Escrever e-mail de campanha de marketing"
    },
    {
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.66-16.88 5.85m19.5 1.9c-3.5-.93-6.63-.82-8.94 0-2.58.92-5.01 2.86-7.44 6.32"/></svg>`,
        text: "Criar conceito de KV para uma campanha"
    },
    {
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`,
        text: "Roteiro para vídeo de 60 segundos"
    },
    {
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`,
        text: "Criar banner de in-app para aplicativo"
    },
    {
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
        text: "Estratégia de conteúdo para redes sociais"
    },
];

// ── State ──
let previousResponseId = null;
let isLoading = false;
let selectedFile = null;

// ── DOM refs ──
const landingView = document.getElementById("landing-view");
const chatView = document.getElementById("chat-view");
const landingInput = document.getElementById("landing-input");
const landingSendBtn = document.getElementById("landing-send-btn");
const chatInput = document.getElementById("chat-input");
const chatSendBtn = document.getElementById("chat-send-btn");
const messagesEl = document.getElementById("messages");
const newChatBtn = document.getElementById("new-chat-btn");
const suggestionsGrid = document.getElementById("suggestions-grid");
const fileInput = document.getElementById("file-input");

// File chip elements
const landingFileChip = document.getElementById("landing-file-chip");
const landingChipName = document.getElementById("landing-chip-name");
const landingChipRemove = document.getElementById("landing-chip-remove");
const chatFileChip = document.getElementById("chat-file-chip");
const chatChipName = document.getElementById("chat-chip-name");
const chatChipRemove = document.getElementById("chat-chip-remove");

// ── Build suggestion cards (visual only, not clickable) ──
SUGGESTIONS.forEach(({ icon, text }) => {
    const card = document.createElement("div");
    card.className = "suggestion-card";
    card.innerHTML = `<div class="card-icon">${icon}</div><span>${text}</span>`;
    suggestionsGrid.appendChild(card);
});

// ── File handling ──
function updateFileChips() {
    const name = selectedFile ? selectedFile.name : "";
    const show = !!selectedFile;

    landingChipName.textContent = name;
    landingFileChip.classList.toggle("hidden", !show);

    chatChipName.textContent = name;
    chatFileChip.classList.toggle("hidden", !show);
}

function clearFile() {
    selectedFile = null;
    fileInput.value = "";
    updateFileChips();
}

// Both attach buttons trigger the shared hidden file input
document.getElementById("landing-attach-btn").addEventListener("click", () => fileInput.click());
document.getElementById("chat-attach-btn").addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", () => {
    selectedFile = fileInput.files[0] || null;
    updateFileChips();
});

landingChipRemove.addEventListener("click", clearFile);
chatChipRemove.addEventListener("click", clearFile);

// ── View switching ──
function showChat() {
    landingView.classList.add("hidden");
    chatView.classList.remove("hidden");
}

function resetChat() {
    previousResponseId = null;
    messagesEl.innerHTML = "";
    chatInput.value = "";
    clearFile();
    chatView.classList.add("hidden");
    landingView.classList.remove("hidden");
}

newChatBtn.addEventListener("click", resetChat);

// ── Message rendering ──
function appendMessage(role, text, attachmentName) {
    const msg = document.createElement("div");
    msg.className = `message ${role}`;

    const roleLabel = document.createElement("div");
    roleLabel.className = "message-role";
    roleLabel.textContent = role === "user" ? "Você" : "Content Designer";

    if (attachmentName) {
        const att = document.createElement("div");
        att.className = "message-attachment";
        att.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg> ${attachmentName}`;
        msg.appendChild(roleLabel);
        msg.appendChild(att);
    } else {
        msg.appendChild(roleLabel);
    }

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    if (text) bubble.textContent = text;

    msg.appendChild(bubble);
    messagesEl.appendChild(msg);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    return bubble;
}

// ── Send message ──
async function submitMessage(text) {
    const message = text.trim();
    const file = selectedFile;

    if (!message && !file) return;
    if (isLoading) return;

    isLoading = true;
    setInputsDisabled(true);

    showChat();

    const displayText = message || `Analisar: ${file.name}`;
    appendMessage("user", displayText, file ? file.name : null);

    const aiBubble = appendMessage("assistant", "");
    aiBubble.classList.add("loading");

    // Build FormData (suporta arquivo + texto)
    const formData = new FormData();
    formData.append("message", message);
    if (previousResponseId) {
        formData.append("previous_response_id", previousResponseId);
    }
    if (file) {
        formData.append("file", file);
    }

    clearFile();

    try {
        const res = await fetch("/api/chat", {
            method: "POST",
            body: formData,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop();

            for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const raw = line.slice(6).trim();
                if (!raw) continue;

                const data = JSON.parse(raw);
                if (data.type === "text") {
                    fullText += data.text;
                    aiBubble.textContent = fullText;
                    messagesEl.scrollTop = messagesEl.scrollHeight;
                } else if (data.type === "done") {
                    previousResponseId = data.response_id;
                } else if (data.type === "error") {
                    aiBubble.textContent = "Erro: " + data.message;
                }
            }
        }

        aiBubble.classList.remove("loading");
        if (!fullText) aiBubble.textContent = "Sem resposta.";

    } catch (err) {
        aiBubble.classList.remove("loading");
        aiBubble.textContent = "Erro ao conectar com o agente. Tente novamente.";
        console.error(err);
    } finally {
        isLoading = false;
        setInputsDisabled(false);
        chatInput.focus();
    }
}

function setInputsDisabled(disabled) {
    landingInput.disabled = disabled;
    landingSendBtn.disabled = disabled;
    chatInput.disabled = disabled;
    chatSendBtn.disabled = disabled;
}

// ── Event listeners ──
landingSendBtn.addEventListener("click", () => {
    const text = landingInput.value;
    landingInput.value = "";
    submitMessage(text);
});

landingInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const text = landingInput.value;
        landingInput.value = "";
        submitMessage(text);
    }
});

chatSendBtn.addEventListener("click", () => {
    const text = chatInput.value;
    chatInput.value = "";
    submitMessage(text);
});

chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const text = chatInput.value;
        chatInput.value = "";
        submitMessage(text);
    }
});
