const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { nanoid } = require("nanoid");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public")); // Serve index.html + game.js

const rooms = {};
const MAX_SCORE = 5;

function createRoom(id = null) {
    const roomId = id || nanoid(6);
    rooms[roomId] = {
        players: {}, // left and right
        spectators: [],
        ball: resetBall(),
        gameStarted: false,
        gameActive: false,
        turn: "left"
    };
    return roomId;
}

function resetBall() {
    return {
        x: 400,
        y: 250,
        radius: 10,
        vx: 10,
        vy: 10
    };
}

io.on("connection", (socket) => {
    let currentRoom = null;
    let playerRole = null;

    socket.on("joinRoom", (requestedRoomId) => {
        // Create or join room
        const roomId = requestedRoomId || createRoom();
        if (!rooms[roomId]) createRoom(roomId);

        const room = rooms[roomId];
        currentRoom = roomId;

        // Assign role
        if (!room.players.left) {
            room.players.left = { id: socket.id, x: 50, y: 200, score: 0 };
            playerRole = "left";
        } else if (!room.players.right) {
            room.players.right = { id: socket.id, x: 100, y: 200, score: 0 };
            playerRole = "right";
        } else {
            room.spectators.push(socket.id);
            playerRole = "spectator";
        }

        console.log(room)

        socket.join(roomId);
        socket.emit("joinedRoom", { roomId, playerType: playerRole });

        emitGameState(roomId);
    });

    socket.on("startGame", () => {
        const room = rooms[currentRoom];
        if (!room || room.gameStarted) return;
        room.gameStarted = true;
        room.gameActive = false;
        room.turn = Math.floor(Math.random() * 2) + 1 ? "left" : "right";
        emitGameState(currentRoom);
    });

    socket.on("serveBall", () => {
        const room = rooms[currentRoom];
        if (!room || !room.gameStarted || room.gameActive) return;

        room.ball = resetBall();
        room.gameActive = true;
        emitGameState(currentRoom);
    });

    socket.on("movePaddle", (direction) => {
        const room = rooms[currentRoom];
        if (!room || !playerRole || playerRole === "spectator") return;

        const paddle = room.players[playerRole];
        if (!paddle) return;

        const speed = 50;
        if (direction === "up") paddle.y = Math.max(0, paddle.y - speed);
        if (direction === "down") paddle.y = Math.min(400, paddle.y + speed);
    });

    socket.on("disconnect", () => {
        if (!currentRoom) return;
        const room = rooms[currentRoom];
        if (!room) return;

        if (room.players.left?.id === socket.id) delete room.players.left;
        else if (room.players.right?.id === socket.id) delete room.players.right;
        else room.spectators = room.spectators.filter(id => id !== socket.id);

        if (Object.keys(room.players).length === 0) {
            delete rooms[currentRoom];
        } else {
            emitGameState(currentRoom);
        }
    });

    socket.on("pingCheck", (cb) => {
        cb();
    });
});

// Game loop: squash logic
setInterval(() => {
    for (const [roomId, room] of Object.entries(rooms)) {
        if (!room.gameActive) continue;

        const ball = room.ball;
        ball.x += ball.vx;
        ball.y += ball.vy;

        // Bounce off top/bottom
        if (ball.y < ball.radius || ball.y > 500 - ball.radius) {
            ball.vy *= -1;
        }

        // Bounce off right wall
        if (ball.x > 800 - ball.radius) {
            ball.vx *= -1;
        }

        // Paddle hit/miss on left
        if (ball.x - ball.radius < 100) {
            if (ball.x < 60 && ball.x > 40 && ball.y >= room.players.left.y && ball.y <= room.players.left.y + 100) {
                if (room.turn === 'left') {
                    ball.vx *= -1;
                    setTimeout(() => {
                        room.turn = "right";
                    }, 1000)
                }
            }
            else if (ball.x < 110 && ball.x > 90 && ball.y >= room.players.right.y && ball.y <= room.players.right.y + 100) {
                if (room.turn === 'right') {
                    ball.vx *= -1;
                    setTimeout(() => {
                        room.turn = "left";
                    }, 1000)
                }
            }
        }

        if (ball.x < 0) {
            room.gameActive = false;
            const opponent = room.turn === "left" ? "right" : "left";
            if (room.players[opponent]) {
                room.players[opponent].score++;

                if (room.players[opponent].score >= MAX_SCORE) {
                    room.gameStarted = false;
                    room.gameActive = false;
        
                    io.to(roomId).emit("gameOver", {
                        winner: opponent === 'left' ? 'Blue' : 'Red',
                        score: room.players[opponent].score
                    });
        
                    return; // Skip reset
                }
            }
            room.ball = resetBall();
            room.turn = opponent;
        }

        emitGameState(roomId);
    }
}, 1000 / 60);

function emitGameState(roomId) {
    const room = rooms[roomId];
    if (!room) return;

    const state = {
        players: {
            left: room.players.left ? { x: room.players.left.x, y: room.players.left.y, score: room.players.left.score } : null,
            right: room.players.right ? { x: room.players.right.x, y: room.players.right.y, score: room.players.right.score } : null
        },
        ball: room.ball,
        gameStarted: room.gameStarted,
        gameActive: room.gameActive,
        turn: room.turn,
        serverTimestamp: Date.now() // <-- Time sync added here
    };

    io.to(roomId).emit("gameState", state);
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
