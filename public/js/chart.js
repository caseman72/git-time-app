(function(ng) {
	var days_of_week = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

	var do_chart = function(data) {
		$("#chart").highcharts({
			credits: {
				enabled: false
			},
			chart: {
				type: "column"
			},
			title: {
				text: "Git Time Of Day"
			},
			xAxis: {
				title: { text: "Hour" },
				categories: [
					"0", "1", "2", "3", "4",
					"5", "6", "7", "8", "9",
					"10", "11", "12", "13", "14",
					"15", "16", "17", "18", "19",
					"20", "21", "22", "23"
				]
			},
			yAxis: {
				min: 0,
				title: { text: "Count" },
				stackLabels: {
					enabled: false,
					style: { "font-weight": "bold", "color": "gray" }
				}
			},
			legend: {
				x: -70,
				y: 20,
				align: "right",
				verticalAlign: "top",
				floating: true,
				backgroundColor: "white",
				borderColor: "#CCC",
				borderWidth: 1,
				shadow: false
			},
			tooltip: {
				formatter: function () {
					return "<b>Hour: " + this.x + "</b><br/>" +
						this.series.name + ": " + this.y + "<br/>" +
						"Total: " + this.point.stackTotal;
				}
			},
			plotOptions: {
				column: {
					stacking: "normal",
					dataLabels: {
						enabled: true,
						style: { "color": "white", "font-weight": "bold"}
					}
				}
			},
			exporting: {
				buttons: {
					contextButton: {
						menuItems: [
							{
								text: "Export to PNG (small)",
								onclick: function () { this.exportChart({width: 250}); }
							},
							{
								text: "Export to PNG (large)",
								onclick: function () { this.exportChart(); },
							},
							{
								text: "&nbsp;",
								onclick: function () { },
								separator: true
							},
							{
								text: "Refresh Full Git Index (>60s)",
								onclick: function () { $("#emails").focus().scope().reload(); },
							},
							{
								text: "Refresh",
								onclick: function () { $("#emails").focus().scope().load(); },
							}
						]
					}
				}
			},
			series: data
		});
	};

	// move to client
	var do_histogram = function (commits, $scope) {
		var histogram = {};
		for (var i = 0, n = commits.length; i < n; i++) {
			var commit = commits[i];

			// rules - controls
			if (commit.merge) continue;
			if (!$scope.emails[commit.email]._selected) continue;
			if (!$scope.branches[commit.branch]._selected) continue;
			if (!$scope.months[commit.month]._selected) continue;
			if (!$scope.days[commit.day]._selected) continue;

			var this_hour = "h_" + new Date(commit.date).getHours();

			if (typeof(histogram[this_hour]) === "undefined") {
				histogram[this_hour] = {
					files: 0,
					insertions: 0,
					deletions: 0,
					pushes: 0
				};
			}

			histogram[this_hour]["files"] += commit.files;
			histogram[this_hour]["insertions"] += commit.insertions;
			histogram[this_hour]["deletions"] += commit.deletions;
			histogram[this_hour]["pushes"]++;
		}

		var data_hash = {
			files: {
				name: "Files",
				data: []
			},
			insertions: {
				name: "Insertions",
				data: []
			},
			deletions: {
				name: "Deletions",
				data: []
			},
			pushes: {
				name: "Pushes",
				data: []
			}
		};

		for (var h = 0; h < 24; h++) {
			var this_hour = "h_" + h;

			if (typeof(histogram[this_hour]) === "undefined") {
				data_hash.files.data.push(0);
				data_hash.insertions.data.push(0);
				data_hash.deletions.data.push(0);
				data_hash.pushes.data.push(0);
			}
			else {
				data_hash.files.data.push(histogram[this_hour].files);
				data_hash.insertions.data.push(histogram[this_hour].insertions);
				data_hash.deletions.data.push(histogram[this_hour].deletions);
				data_hash.pushes.data.push(histogram[this_hour].pushes);
			}
		}

		return [
			data_hash.files,
			data_hash.insertions,
			data_hash.deletions,
			data_hash.pushes
		];
	};

	var app = ng.module("gitApp", []);
	app.controller("IndexCtrl", ["$scope", "$http", function($scope, $http) {

		$scope.reset = function() {
			$scope.data = [];
			$scope.emails = {};
			$scope.branches = {};
			$scope.months = {};
			$scope.days = {};
			$scope.ordered_days = [];

			do_chart(do_histogram($scope.data, $scope));
		};

		// controls
		$scope.controls = {
			emails: {
				_all: false,
				_singular: true
			},
			branches: {
				_all: true,
				_singular: false
			},
			months: {
				_all: true,
				_singular: false
			},
			days: {
				_all: true,
				_singular: false
			}
		};
		ng.forEach($scope.controls, function(obj, key) {
			Object.defineProperty(obj, "all", {
				set: function(val) {
					val = val ? true : false;

					this._all = val;
					if (val) {
						this._singular = false;
					}
					ng.forEach($scope[key], function(e) {
						e._selected = val;
					});

					do_chart(do_histogram($scope.data, $scope));
				},
				get: function() {
					return this._all;
				}
			});
			Object.defineProperty(obj, "1x", {
				set: function(val) {
					val = val ? true : false;

					this._singular = val;
					if (val) {
						this._all = false;
						ng.forEach($scope[key], function(e) {
							e._selected = false;
						});
					}

					do_chart(do_histogram($scope.data, $scope));
				},
				get: function() {
					return this._singular;
				}
			});
		});

		$scope.load_data = function(commits) {
			$scope.data = commits;

			var emails = {};
			var branches = {};
			var months = {};

			for (var i = 0, n = commits.length; i < n; i++) {
				var commit = commits[i];
				if (commit.merge) continue;

				var this_date = new Date(commit.date);
				commit.month = ("" + this_date.getFullYear() + "-0" + (this_date.getMonth()+1)).replace(/-0([12][0-9])$/, "-$1");
				commit.day = days_of_week[ this_date.getDay() ];

				// emails
				if(!ng.isDefined(emails[commit.email])) {
					var item = {
						_selected: false,
						label: commit.email
					};

					Object.defineProperty(item, "selected", {
						set: function(val) {
							if ($scope.controls.emails._singular) {
								ng.forEach($scope.emails, function(e) {
									e._selected = false;
								});
							}

							this._selected = val ? true : false;
							do_chart(do_histogram($scope.data, $scope));
						},
						get: function() {
							return this._selected;
						}
					});

					emails[commit.email] = item;
				}

				// branches
				if(!ng.isDefined(branches[commit.branch])) {
					var item = {
						_selected: true,
						label: commit.branch
					};

					Object.defineProperty(item, "selected", {
						set: function(val) {
							if ($scope.controls.branches._singular) {
								ng.forEach($scope.branches, function(b) {
									b._selected = false;
								});
							}

							this._selected = val ? true : false;
							do_chart(do_histogram($scope.data, $scope));
						},
						get: function() {
							return this._selected;
						}
					});

					branches[commit.branch] = item;
				}

				// months
				if(!ng.isDefined(months[commit.month])) {
					var item = {
						_selected: true,
						label: commit.month 
					};

					Object.defineProperty(item, "selected", {
						set: function(val) {
							if ($scope.controls.months._singular) {
								ng.forEach($scope.months, function(m) {
									m._selected = false;
								});
							}

							this._selected = val ? true : false;
							do_chart(do_histogram($scope.data, $scope));
						},
						get: function() {
							return this._selected;
						}
					});

					months[commit.month] = item;
				}
			}

			var days = {};
			var ordered_days = [];

			// days
			ng.forEach(days_of_week, function(day, index) {
				var item = {
					_selected: true,
					label: day,
					index: index
				};

				Object.defineProperty(item, "selected", {
					set: function(val) {
						if ($scope.controls.days._singular) {
							ng.forEach($scope.days, function(m) {
								m._selected = false;
							});
						}

						this._selected = val ? true : false;
						do_chart(do_histogram($scope.data, $scope));
					},
					get: function() {
						return this._selected;
					}
				});

				days[day] = item;
				ordered_days.push(item);
			});

			$scope.emails = emails;
			$scope.branches = branches;
			$scope.months = months;
			$scope.days = days;
			$scope.ordered_days = ordered_days;

			do_chart(do_histogram($scope.data, $scope));
		}

		$scope.reload = function() {
			$scope.reset();
			$http.get("/commits/refresh.json").then(function(response) {
				$scope.load_data(response.data);
			});
		};

		$scope.load = function() {
			$scope.reset();
			$http.get("/commits.json").then(function(response) {
				$scope.load_data(response.data);
			});
		};

		$scope.load(); // init
	}]);

})(window.angular);
