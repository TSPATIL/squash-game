const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const startGameBtn = document.getElementById("startGameBtn");
const serveBtn = document.getElementById("serveBtn");
const roomForm = document.getElementById("roomForm");
const roomInput = document.getElementById("roomInput");
const roomDisplay = document.getElementById("roomDisplay");
const playerName = document.getElementById("player");

const socket = io();
let playerType = null;
let gameState = null;
let roomId = new URLSearchParams(window.location.search).get("room");

let smoothPaddles = {
    left: { x: 0, y: 0 },
    right: { x: 0, y: 0 }
};

function lerp(a, b, t) {
    return a + (b - a) * t;
}

// Auto-join room from URL
if (roomId) {
    joinRoom(roomId);
} else {
    roomForm.style.display = "block";
}

// Handle room form
roomForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const inputRoom = roomInput.value.trim();
    roomId = inputRoom || null;
    joinRoom(roomId);
    roomForm.style.display = "none";
});

// Request room join
function joinRoom(id) {
    socket.emit("joinRoom", id);
}

// Server response with final room ID + player type
socket.on("joinedRoom", ({ roomId: joinedId, playerType: type }) => {
    roomId = joinedId;

    const url = new URL(window.location.href);
    url.searchParams.set("room", roomId);
    window.history.pushState({}, "", url);

    roomDisplay.textContent = `Room ID: ${roomId}`;
    playerType = type;
    playerName.textContent = `You are: ${playerType === 'left' ? 'Blue' : 'Red'}`;

    if (type === "spectator") {
        alert("Room is full. You are watching as a spectator.");
    }
});

// Game state updates from server
socket.on("gameState", (state) => {
    const now = Date.now();
    const serverTime = state.serverTimestamp;
    const delay = now - serverTime;

    document.getElementById("latencyDisplay").innerText = `One-way Delay: ${delay}ms`;

    gameState = state;

    if (state.players.left) {
        smoothPaddles.left.y = lerp(smoothPaddles.left.y, state.players.left.y, 0.2);
        smoothPaddles.left.x = state.players.left.x; // x doesn't change for left
    }
    if (state.players.right) {
        smoothPaddles.right.y = lerp(smoothPaddles.right.y, state.players.right.y, 0.2);
        smoothPaddles.right.x = state.players.right.x; // x might be different in your setup
    }

    drawGame();

    // Button logic
    if (!gameState.gameStarted) {
        serveBtn.style.display = "none";
    } else if (!gameState.gameActive && playerType === gameState.turn) {
        serveBtn.style.display = "block";
    } else {
        serveBtn.style.display = "none";
    }
});

socket.on("gameOver", (data) => {
    alert(`🎉 Player ${data.winner.toUpperCase()} wins with score ${data.score}!`);
    // Optionally: reset scores or reload
});

// Control buttons
startGameBtn.addEventListener("click", () => {
    socket.emit("startGame");
});

serveBtn.addEventListener("click", () => {
    socket.emit("serveBall");
});

// Paddle movement
document.addEventListener("keydown", (e) => {
    if (playerType === "spectator") return;

    if (e.key === "ArrowUp") {
        socket.emit("movePaddle", "up");
    } else if (e.key === "ArrowDown") {
        socket.emit("movePaddle", "down");
    }
});


// Draw the entire game
function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw left paddles (both players)
    if (gameState.players.left) {
        ctx.fillStyle = "blue";
        // ctx.fillRect(gameState.players.left.x, gameState.players.left.y, 10, 100);
        ctx.fillRect(smoothPaddles.left.x, smoothPaddles.left.y, 10, 100);
    }
    if (gameState.players.right) {
        ctx.fillStyle = "red";
        // ctx.fillRect(gameState.players.right.x, gameState.players.right.y, 10, 100);
        ctx.fillRect(smoothPaddles.right.x, smoothPaddles.right.y, 10, 100);
    }

    // Draw the ball
    // ctx.beginPath();
    // ctx.arc(gameState.ball.x, gameState.ball.y, gameState.ball.radius, 0, Math.PI * 2);
    // ctx.fillStyle = "black";
    // ctx.fill();
    // ctx.closePath();

    const now = Date.now();
    const serverTime = gameState.serverTimestamp;
    const delay = now - serverTime;

    // Predict ball position
    const predictedX = gameState.ball.x + gameState.ball.vx * (delay / 1000);
    const predictedY = gameState.ball.y + gameState.ball.vy * (delay / 1000);

    ctx.beginPath();
    ctx.arc(predictedX, predictedY, gameState.ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = "black";
    ctx.fill();
    ctx.closePath();

    // Scores
    ctx.font = "20px Arial";
    ctx.fillText(`Blue: ${gameState.players.left?.score || 0}`, 50, 20);
    ctx.fillText(`Turn : ${gameState.turn === 'left' ? 'Blue' : 'Red'}`, 380, 20);
    ctx.fillText(`Red: ${gameState.players.right?.score || 0}`, 650, 20);

    // Game status messages
    if (!gameState.gameStarted) {
        ctx.fillText("Click 'Start Game' to begin", 300, 250);
    } else if (!gameState.gameActive && playerType === gameState.turn) {
        ctx.fillText("Your turn to serve!", 320, 250);
    } else if (!gameState.gameActive) {
        ctx.fillText("Waiting for opponent to serve...", 270, 250);
    }
}

let ping = 0;
setInterval(() => {
    const start = Date.now();
    socket.emit("pingCheck", () => {
        ping = Date.now() - start;
        document.getElementById("pingDisplay").innerText = `Ping: ${ping}ms`;
    });
}, 1000);
