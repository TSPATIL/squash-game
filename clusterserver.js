// clusterServer.js
const cluster = require("cluster");
const os = require("os");

const numCPUs = os.cpus().length;

if (cluster.isPrimary) {
    console.log(`🧠 Master process running on PID ${process.pid}`);
    console.log(`🔧 Forking ${numCPUs} worker nodes...\n`);

    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on("exit", (worker, code, signal) => {
        console.log(`❌ Worker ${worker.process.pid} died. Restarting...`);
        cluster.fork();
    });
} else {
    console.log(`🚀 Worker PID ${process.pid} started`);
    require("./server"); // your existing server file
}
