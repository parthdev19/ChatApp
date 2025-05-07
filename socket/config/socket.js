// socket.js
let ioInstance = null;

module.exports = {
    init: (server) => {
        ioInstance = require("socket.io")(server, {
            cors: {
                origin: "*", 
                methods: ["GET", "POST"]
            }
        });
        return ioInstance;
    },
    getIO: () => {
        if (!ioInstance) {
            throw new Error("Socket.io not initialized!");
        }
        return ioInstance;
    }
};
