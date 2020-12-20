#!/usr/bin/env node
const express = require("express");
const session = require("express-session");
const csurf = require("csurf");
const fetch = require("node-fetch");
const fs = require("fs");
const rateLimit = require("express-rate-limit");

const config = require("./config.json");
let games;
try {
	games = require("./games.json");
} catch (err) {
	games = [];
}

const app = express();

app.set("view engine", "pug");

app.use(
	// Limit each IP to 1,000 requests per 1 minute
	rateLimit({
		windowMs: 1 * 60 * 1000,
		max: 10000,
	}),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
	session({
		// Don't save session if unmodified
		resave: false,
		// Don't create session until something stored
		saveUninitialized: false,
		secret: config.secret || "hunter2",
	}),
);
app.use(csurf({ cookie: false }));

app.get("/", (req, res) => {
	res.render("form", { csrfToken: req.csrfToken() });
});

app.post("/", async (req, res) => {
	const game = req.body;
	game.rules = game.rules.split(" ").join(" ");
	game.aboutme = game.aboutme.split(" ").join(" ");
	game.notes = game.notes.split(" ").join(" ");
	const gameToSave = {
		content: null,
		embeds: [
			{
				color: 2424603,
				fields: [
					{
						name: "Game/Map name",
						value: game.game || "No name provided",
						inline: true,
					},
					{
						name: "Download/Website link",
						value: `[Website](${game.website})`,
						inline: true,
					},
					{
						name: "Proposed categories and rules",
						value: game.rules || "No rules provided",
					},
					{
						name: "Video of a completed run",
						value: `[Video](${game.video})`,
					},
					{
						name: "A bit about yourself",
						value: game.aboutme || "No info provided",
					},
					{
						name: "Additional notes",
						value: game.notes || "No Additional notes provided",
					},
				],
				author: {
					name: `Submitted by ${game.author}`,
				},
			},
		],
	};
	if(config.webhookURL) {
	const response = await fetch(config.webhookURL, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(gameToSave),
	});
}
	games.push(gameToSave);
	if (!response.ok) {
		res
			.status(response.status)
			.send(
				"Something went wrong, please try again later and let an admin know about this. Thank you!",
			);
		console.log(await response.json());
		return;
	}
	fs.writeFile("./games.json", JSON.stringify(games, null, "\t"), (err) => {
		if (err) {
			res
				.status(500)
				.send(
					"Something went wrong, please try again later and let an admin know about this. Thank you!",
				);
			return;
		}
	});
	res.render("form", { csrfToken: req.csrfToken() ,message: "Submission submitted. Please wait up to 3 weeks for a moderator to respond. Thanks!"});
});

app.listen(config.port || 5000);
