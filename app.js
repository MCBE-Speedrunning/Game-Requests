#!/usr/bin/env node
const express = require("express");
const session = require("express-session");
const csurf = require("csurf");
const fetch = require("node-fetch");
const fs = require("fs");
const rateLimit = require("express-rate-limit");
const config = require("./config.json");
const FormData = require("form-data");

let games;
try {
	games = require("./games.json");
} catch (err) {
	games = [];
}

/*
 * Limit each IP to 10 requests minute,
 * anyone doing more is likely spamming
 */
const app = express();
app.set("view engine", "pug");
app.set("trust proxy", 1);
app.use(
	rateLimit({
		windowMs: 1 * 60 * 1000,
		max: 10,
	})
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
	session({
		/* Don't save session if unmodified */
		resave: false,
		saveUninitialized: true,
		secret: config.secret || "hunter2",
	})
);
app.use(csurf({ cookie: false }));

app.get("/", (req, res) => {
	res.render("form", { csrfToken: req.csrfToken() });
});

app.post("/", async (req, res) => {
	if (req.body.math != 19) return res.send("You stupid");
	const game = req.body;
	delete game._csrf;
	delete game.captcha;
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
						name: "Game/Map Name",
						value: game.game || "No name provided",
						inline: true,
					},
					{
						name: "Download/Website Link",
						value: `[Website](${game.website})`,
						inline: true,
					},
					{
						name: "Proposed Categories and Rules",
						value: game.rules || "No rules provided",
					},
					{
						name: "Video of Completed Run",
						value: `[Video](${game.video})`,
					},
					{
						name: "Player Info",
						value: game.aboutme || "No info provided",
					},
					{
						name: "Additional Notes",
						value: game.notes || "No Additional notes provided",
					},
				],
				author: {
					name: `Submitted by ${game.author}`,
				},
			},
		],
	};

	games.push(game);
	// Firt save the game so in case anything happens we still have a backup
	fs.writeFile("./games.json", JSON.stringify(games, null, "\t"), (err) => {
		if (err) {
			res.status(500).send(
				"Something went wrong when saving your submission, please try again later and let an admin know about this. Thank you!\n" + JSON.stringify(err, null, 4)
			);
			return;
		}
	});

	if (config.webhookURL[req.body.edition]) {
		const response = await fetch(config.webhookURL[req.body.edition], {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(gameToSave),
		});
		if (!response.ok) {
			return res.status(responseFile.status).send(
				"Something went wrong when sending your request on discord, but your submission was saved, please try again later and let an admin know about this. Thank you!\n" + await responseFile.text()
			);
		}
		
		
		res.render("form", {
			csrfToken: req.csrfToken(),
			message:
			"Submission submitted. Please wait up to 3 weeks for a moderator to respond. Thanks!",
		});
	} else {
		res.render("form", {
			csrfToken: req.csrfToken(),
			message:
			"No discord webhook found. Submission saved. Please wait up to 3 weeks for a moderator to respond. Thanks!",
		});
	}
});

// Error handler
app.use((err, _req, res, _next) => {
	if (err.code == "EBADCSRFTOKEN") return res.status(403).send("Please refresh the page and try again. ");
	res.status(err.status || 500).send(`An unexpected error has occured.
		This is probably a problem with the website and the moderators got your request.
		Feel free to send the following output to a moderator. \n${err}`);
});

app.listen(config.port || 5000, () => 
	console.log(`Running at http://localhost:${config.port || 5000}`));
