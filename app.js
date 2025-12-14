/* ================================================
   API URLs (LOCAL DEVELOPMENT)
=================================================== */
//const API_MACROS_URL = "http://localhost:3000/macros";
//const API_CHAT_URL = "http://localhost:3000/chat";

const API_MACROS_URL = "https://foodscan-macros-backend.onrender.com/macros";
const API_CHAT_URL   = "https://foodscan-macros-backend.onrender.com/chat";


/* ================================================
   SCREEN ELEMENTS
=================================================== */
const chatScreen = document.getElementById("screen-chat");
const cameraScreen = document.getElementById("screen-camera");
const processingScreen = document.getElementById("screen-processing");
const resultsScreen = document.getElementById("screen-results");

const chatContainer = document.getElementById("chat-container");
const chatInput = document.getElementById("chatInput");

/* ================================================
   CAMERA SETUP
=================================================== */
const cameraInput = document.getElementById("cameraInput");
const cameraShutter = document.getElementById("cameraShutter");

let selectedQuantity = 1;
let baseData = null; // backend result stored globally

/* OPEN CAMERA SCREEN */
document.getElementById("openCameraBtn").onclick = () => {
    chatScreen.classList.add("hidden");
    cameraScreen.classList.remove("hidden");
};

/* BACK BUTTON */
document.getElementById("cameraBackBtn").onclick = () => {
    cameraScreen.classList.add("hidden");
    chatScreen.classList.remove("hidden");
};

/* SHUTTER CLICK → open file input */
cameraShutter.onclick = () => cameraInput.click();

/* ================================================
   IMAGE SELECTED
=================================================== */
cameraInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const previewURL = URL.createObjectURL(file);

    // Show processing screen
    processingScreen.classList.remove("hidden");
    document.getElementById("processingImage").src = previewURL;

    const steps = [
        "Analyzing food…",
        "Detecting ingredients…",
        "Estimating quantity…",
        "Calculating macros…",
        "Finalizing nutrition details…"
    ];

    let stepIndex = 0;
    const stepInterval = setInterval(() => {
        document.getElementById("processingText").innerText = steps[stepIndex];
        stepIndex = (stepIndex + 1) % steps.length;
    }, 1200);

    const form = new FormData();
    form.append("image", file);

    const response = await fetch(API_MACROS_URL, {
        method: "POST",
        body: form
    });

    const data = await response.json();
    clearInterval(stepInterval);

    processingScreen.classList.add("hidden");
    resultsScreen.classList.remove("hidden");

    // NO FOOD DETECTED
    if (data.no_food) {
        showNoFoodDetected(previewURL, data);
        return;
    }

    populateResultsUI(data, previewURL);
};

/* ================================================
   NO FOOD DETECTED HANDLER
=================================================== */
function showNoFoodDetected(imgURL, data) {
    document.getElementById("resultImg").src = imgURL;
    document.getElementById("result-title").innerText = "No food detected";
    document.getElementById("result-cal").innerText = "";
    document.getElementById("result-macros").innerText = "";
    document.getElementById("result-fibre").innerText = "";
    document.getElementById("result-ingredients").innerHTML =
        "<li class='text-red-400'>Image unclear.</li>";
    document.getElementById("result-notes").innerText = data.message || "";

    document.getElementById("confirmBtn").onclick = () => returnToChat();
}

/* ================================================
   POPULATE RESULTS UI
=================================================== */
function populateResultsUI(data, imgURL) {

    baseData = data; // store original result for later recalculation
    selectedQuantity = data.quantity?.value || 1;

    document.getElementById("qtyValue").innerText = selectedQuantity;

    updateResultsUI(data, imgURL);

    // --- QUANTITY BUTTONS ---
    document.getElementById("qtyMinus").onclick = () => {
        if (selectedQuantity > 1) {
            selectedQuantity--;
            document.getElementById("qtyValue").innerText = selectedQuantity;
            updateResultsUI(baseData, imgURL);
        }
    };

    document.getElementById("qtyPlus").onclick = () => {
        selectedQuantity++;
        document.getElementById("qtyValue").innerText = selectedQuantity;
        updateResultsUI(baseData, imgURL);
    };

    // --- CONFIRM BUTTON ---
    document.getElementById("confirmBtn").onclick = null;
    document.getElementById("confirmBtn").onclick = () => {
        addImageBubble(imgURL);
        appendFoodCardToChat(baseData, imgURL, selectedQuantity);
        addNotesMessage(baseData.notes);
        returnToChat();
    };
}

document.getElementById("retakeBtn").onclick = () => {
    resultsScreen.classList.add("hidden");
    cameraScreen.classList.remove("hidden");
};

/* ================================================
   RETURN TO CHAT SCREEN
=================================================== */
function returnToChat() {
    resultsScreen.classList.add("hidden");
    chatScreen.classList.remove("hidden");
}

/* ================================================
   FOOD CARD IN CHAT
=================================================== */
function appendFoodCardToChat(data, imgURL, qty = 1) {

    const macros = data.macros_per_unit;

    const totals = {
        calories: (macros.calories || 0) * qty,
        protein: (macros.protein_g || 0) * qty,
        carbs: (macros.carbs_g || 0) * qty,
        fat: (macros.fat_g || 0) * qty,
        fibre: (macros.fibre_g || 0) * qty
    };

    const card = document.createElement("div");
    card.className = "bg-gray-800 p-4 rounded-xl shadow flex gap-4 items-start";

    card.innerHTML = `
        <img src="${imgURL}" class="w-16 h-16 object-cover rounded-xl" />

        <div class="flex-1">
            <p class="font-bold text-white">${data.food}</p>
            <p class="text-gray-400 text-sm">Quantity: ${qty} × ${data.quantity.unit}</p>
            <p class="text-gray-300">${totals.calories} kcal</p>

            <p class="text-gray-400 text-sm mt-1">
                P: ${totals.protein.toFixed(1)}g |
                C: ${totals.carbs.toFixed(1)}g |
                F: ${totals.fat.toFixed(1)}g |
                Fibre: ${totals.fibre.toFixed(1)}g
            </p>

            <p class="font-semibold text-white mt-3">Ingredients</p>
            <ul class="text-gray-300 text-sm mt-1">
                ${data.ingredients
                    ?.map(i => `<li>${i.item} — ${i.quantity} (${Math.round(i.confidence * 100)}%)</li>`)
                    .join("")}
            </ul>
        </div>
    `;

    chatContainer.appendChild(card);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}


/* ================================================
   SEND TEXT MESSAGE
=================================================== */
document.getElementById("sendBtn").onclick = sendMessage;

chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
});

async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    appendUserMessage(text);
    chatInput.value = "";

    showThinkingIndicator();

    const response = await fetch(API_CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text })
    });

    const data = await response.json();

    removeThinkingIndicator();
    appendBotMessage(data.reply || "I didn't understand that.");
}

/* ================================================
   CHAT BUBBLE HELPERS
=================================================== */
function appendUserMessage(msg) {
    const bubble = document.createElement("div");
    bubble.className = "self-end bg-blue-600 p-3 rounded-xl max-w-[75%]";
    bubble.innerText = msg;

    chatContainer.appendChild(bubble);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function appendBotMessage(msg) {
    const bubble = document.createElement("div");
    bubble.className = "self-start bg-gray-700 p-3 rounded-xl max-w-[75%]";
    bubble.innerText = msg;

    chatContainer.appendChild(bubble);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

/* ================================================
   TYPING INDICATOR
=================================================== */
function showThinkingIndicator() {
    const div = document.createElement("div");
    div.id = "typingIndicator";
    div.className = "self-start bg-gray-700 p-3 rounded-xl max-w-[70%] text-gray-300 italic";
    div.innerText = "Thinking…";
    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function removeThinkingIndicator() {
    const el = document.getElementById("typingIndicator");
    if (el) el.remove();
}

/* ================================================
   IMAGE BUBBLE
=================================================== */
function addImageBubble(imgURL) {
    const div = document.createElement("div");
    div.className = "self-end";
    div.innerHTML = `
        <img src="${imgURL}" class="w-20 h-20 object-cover rounded-xl border border-gray-700" />
    `;
    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

/* ================================================
   NOTES MESSAGE
=================================================== */
function addNotesMessage(notes) {
    if (!notes) return;

    const div = document.createElement("div");
    div.className = "self-start bg-gray-700 p-3 rounded-xl max-w-[75%] text-sm text-gray-300";
    div.innerText = notes;

    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function updateResultsUI(data, imgURL) {

    const qty = selectedQuantity;
    const macros = data.macros_per_unit || {};

    const totals = {
        calories: (macros.calories || 0) * qty,
        protein: (macros.protein_g || 0) * qty,
        carbs: (macros.carbs_g || 0) * qty,
        fat: (macros.fat_g || 0) * qty,
        fibre: (macros.fibre_g || 0) * qty
    };

    document.getElementById("resultImg").src = imgURL;
    document.getElementById("result-title").innerText = data.food;
    document.getElementById("result-quantity").innerText =
        `${qty} × ${data.quantity.unit} (${data.quantity.weight_g * qty}g total)`;

    document.getElementById("result-cal").innerText = `${totals.calories} kcal`;

    document.getElementById("result-macros").innerText =
        `Protein: ${totals.protein.toFixed(1)}g • Carbs: ${totals.carbs.toFixed(1)}g • Fat: ${totals.fat.toFixed(1)}g`;

    document.getElementById("result-fibre").innerText =
        `Fibre: ${totals.fibre.toFixed(1)}g`;

    document.getElementById("result-ingredients").innerHTML =
        data.ingredients
            ?.map(i => `<li>${i.item} — ${i.quantity} (${Math.round(i.confidence * 100)}%)</li>`)
            .join("");
}

