const directline = require("offline-directline");
const express = require("express");
const path = require("path");

var server = {
    start: function (port, botUrl) {
        const app = express();
        directline.initializeRoutes(app, "http://localhost:" + port, botUrl);

        app.get("/", (req, res) => {
            res.sendFile(path.join(__dirname + "/index.html"));
        });
    }
}

module.exports = {
    server: server
}