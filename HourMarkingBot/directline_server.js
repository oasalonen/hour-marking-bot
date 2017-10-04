﻿const directline = require("offline-directline");
const express = require("express");
const path = require("path");
const morgan = require("morgan");

var server = {
    start: function (serviceUrl, botUrl) {
        console.log("Using service URL" + serviceUrl);
        console.log("Connecting to bot at " + botUrl);

        const app = express();
        app.use(morgan("dev"));
        directline.initializeRoutes(app, serviceUrl, botUrl);

        app.get("/", (req, res) => {
            res.sendFile(path.join(__dirname + "/index.html"));
        });
    }
}

module.exports = {
    server: server
}
