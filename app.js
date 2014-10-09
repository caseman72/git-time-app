// requires
require("string-utils");
var exec = require("child_process").exec;
var async = require("async");
var express = require("express");


// this app's secret config values
var config = {
	server_port: process.env.NODE_APP_PORT || "3030",
	node_debug: process.env.NODE_APP_DEBUG ? true : false,
	git_mirror_pwd: process.env.NODE_GIT_MIRROR || "./mirror"
};

var git_command = [
	"cd {0} && git fetch --all > /dev/null && git log -3000 --branches --source --pretty=oneline".format(config.git_mirror_pwd),
	//"cd {0} && git log -100 --branches --source --pretty=oneline".format(config.git_mirror_pwd),
	"/bin/grep -v 'cibuild[.]php'",
	"/bin/grep -v '[.]CI[.]'",
	"/bin/grep -v 'commit by minify post[-]receive hook'",
	"/bin/grep -v 'Merge branch'",
	"/bin/grep -v 'Merge remote[-]tracking branch'",
	"/bin/grep -v 'automatic.*edit[or]*[.]xap'"

].join(" |");

var stat_command = "cd {0} && git show --format='commit\t%H%nname\t%cn%nemail\t%cE%ndate\t%cD' --stat {1}";

var commits = [];

var do_each = function(commit, done) {
	exec(stat_command.format(config.git_mirror_pwd, commit.commit), function(error, stdout/*, stderr*/) {
		var lines = stdout.trim().split("\n");

		for (var j = 1, m = lines.length; j < m; j ++) {
			var line = lines[j];
			var starts = line.split(/[\t]/).shift().toLowerCase();

			// commit, name, email, merge, date
			if (starts && typeof(commit[starts]) !== "undefined" && !commit[starts]) {
				commit[starts] = line.split(/[\t]/).slice(1).join(" ").trim();

				if (starts == "email") {
					commit[starts] = commit[starts].toLowerCase()
						.replace(/marketleader\.com/g, "trulia.com")
						.replace(/krkdevandyg1\.sky\.dom/g, "trulia.com")
						.replace(/chriss\-macbook\-pro\.local/g, "trulia.com")
						.replace(/beldevmroach1\.sky\.dom/g, "trulia.com");
				}
			}
			else {
				if (line.match(/\s*[0-9]+ files? changed/)) {
					commit.files = +line.replace(/^.*\s*([0-9]+) files? changed.*$/, "$1");
				}
				if (line.match(/\s*[0-9]+ insertion/)) {
					commit.insertions = +line.replace(/^.*\s*([0-9]+) insertion.*$/, "$1");
				}
				if (line.match(/\s*[0-9]+ deletion/)) {
					commit.deletions = +line.replace(/^.*\s*([0-9]+) deletion.*$/, "$1");
				}
			}
		}

		done();
	});
};

var do_commits = function(callback) {
	exec(git_command, function(error, stdout/*, stderr*/) {
		var lines = stdout.trim().split("\n");

		for (var i = 0, n = lines.length; i < n; i++) {
			var line = lines[i].trim();
			var parts = line ? line.split("\t") : [];
			if (parts.length > 1) {
				var words = "{0}".format(parts.slice(1).join(" ")).split(" ");
				commits.push({
					commit: parts[0],
					branch: words[0],
					name: "",
					email: "",
					merge: "",
					date: "",
					files: 0,
					insertions: 0,
					deletions: 0
					, message: words.join(" ")
					//, line: line
				});
			}
		}

		async.eachLimit(commits, 100, do_each, function(/*err*/){ callback(commits); });
	});
};

// load it up
do_commits(function(commits) { console.log("Ready", commits.length); });

// prevent express from defining mount and then overriding it
if (typeof(express.mount) === "undefined") {
	// fix google closure error by mapping static to mount
	express["mount"] = express["static"];
}
else {
	throw new Error('typeof(express.mount) !== "undefined")');
}

var app = express();
app
	.use(express.favicon(__dirname + "/public/images/favicon.ico"))
	.use(express.mount(__dirname + "/public"))
	.use(express.errorHandler({dumbExceptions: true}))
	.disable('etag')
	.enable("strict routing");

app.get("/", function(req, res) {
	res.sendfile(__dirname + "/public/index.htm");
});

app.get("/commits.json", function(req, res) {
	//res.set("Content-Type", "application/json");
	//
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

	if (commits.length) {
		res.json(commits);
	}
	else {
		do_commits(function(commits) {
			res.json(commits);
		});
	}
});

app.get("/commits/refresh.json", function(req, res) {
	commits = []; // reset
	do_commits(function(commits) {
		res.json(commits);
	});
});

app.listen(config.server_port, function(){ console.log("Listening on {0}".format(config.server_port)); });
