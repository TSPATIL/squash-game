// gameWorker.js
const { parentPort } = require('worker_threads');

let rooms = {};

parentPort.on("message", ({ type, payload }) => {
    if (type === "init") {
        rooms = payload;
        gameLoop();
    } else if (type === "updateRoom") {
        rooms[payload.roomId] = payload.roomData;
    }
});

function gameLoop() {
    setInterval(() => {
        for (const roomId in rooms) {
            const room = rooms[roomId];
            if (!room || !room.gameActive) continue;

            const ball = room.ball;
            ball.x += ball.vx;
            ball.y += ball.vy;

            // Collision detection...
            if (ball.y < ball.radius || ball.y > 500 - ball.radius) ball.vy *= -1;
            if (ball.x > 800 - ball.radius) ball.vx *= -1;

            // Simulate paddle collisions, scoring, etc...

            parentPort.postMessage({ type: "roomUpdate", roomId, data: room });
        }
    }, 1000 / 60);
}
