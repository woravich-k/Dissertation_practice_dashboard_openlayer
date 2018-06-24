// queue()
    // .defer(d3.json, "http://woravich-k/myapp/input/data.geojson")
    // .await(makeGraphs);

//adapted from the practicle codes in the module
function loadData(){
	var url = 'http://woravich-k/myapp/input/data.geojson';
	client = new XMLHttpRequest();
	
	client.open('GET', url);
	client.onreadystatechange = dataResponse; 
	client.send();
}

//adapted from the practicle codes in the module
//create the code to wait for the response from the data server, and process the response once it is received
function dataResponse(){
//this function listens out for the server to say that the data is ready - i.e. has state 4
	if (client.readyState == 4){
		//once the data is ready, process the data
		var geoJSONData = client.responseText;
		geoJSONData = JSON.parse(geoJSONData);
		
		makeGraphs(geoJSONData);
	}
}


function makeGraphs(recordsJson) {
	var records = recordsJson;
	
	var dateFormat = d3.time.format("%d-%m-%Y %H:%M:%S");
	
	
	records.forEach(function(d) {
		d["timestamp"] = dateFormat.parse(d["timestamp"]);
		d["timestamp"].setMinutes(0);
		d["timestamp"].setSeconds(0);
		d["longitude"] = +d["longitude"];
		d["latitude"] = +d["latitude"];
	});
	var ndx = crossfilter(records);
	// data dimension _ crossfilter
	var dateDim = ndx.dimension(function(d) { return d["timestamp"]; });
	var genderDim = ndx.dimension(function(d) { return d["gender"]; });
	var ageSegmentDim = ndx.dimension(function(d) { return d["age_segment"]; });
	var phoneBrandDim = ndx.dimension(function(d) { return d["phone_brand_en"]; });
	var locationdDim = ndx.dimension(function(d) { return d["location"]; });
	var allDim = ndx.dimension(function(d) {return d;});
	
	// grounp
	var numRecordsByDate = dateDim.group();
	var genderGroup = genderDim.group();
	var ageSegmentGroup = ageSegmentDim.group();
	var phoneBrandGroup = phoneBrandDim.group();
	var locationGroup = locationdDim.group();
	var all = ndx.groupAll();
	
	// first and last timestamps
	var minDate = dateDim.bottom(1)[0]["timestamp"];
	var maxDate = dateDim.top(1)[0]["timestamp"];
	
	// define charts
	var numberRecordsND = dc.numberDisplay("#number-records-nd");
	var timeChart = dc.barChart("#time-chart");
	var genderChart = dc.rowChart("#gender-row-chart");
	var ageSegmentChart = dc.rowChart("#age-segment-row-chart");
	var phoneBrandChart = dc.rowChart("#phone-brand-row-chart");
	var locationChart = dc.rowChart("#location-row-chart");
	
	
	
	numberRecordsND
    .formatNumber(d3.format("d"))
    .valueAccessor(function(d){return d; })
    .group(all);
	
	timeChart
    .width(1)
    .height(140)
    .margins({top: 0, right: 50, bottom: 20, left: 40})
    .dimension(dateDim)
    .group(numRecordsByDate)
    .transitionDuration(500)
    .x(d3.time.scale().domain([minDate, maxDate]))
    .elasticY(true)
    .yAxis().ticks(4);
	
	genderChart
        .width(300)
        .height(100)
        .dimension(genderDim)
        .group(genderGroup)
        .ordering(function(d) { return -d.value })
        .colors(['#6baed6'])
        .elasticX(true)
        .xAxis().ticks(4);
		
	ageSegmentChart
    .width(300)
    .height(150)
        .dimension(ageSegmentDim)
        .group(ageSegmentGroup)
        .colors(['#6baed6'])
        .elasticX(true)
        .labelOffsetY(10)
        .xAxis().ticks(4);
		
	phoneBrandChart
    .width(300)
    .height(310)
        .dimension(phoneBrandDim)
        .group(phoneBrandGroup)
        .ordering(function(d) { return -d.value })
        .colors(['#6baed6'])
        .elasticX(true)
        .xAxis().ticks(4);

    locationChart
      .width(200)
    .height(510)
        .dimension(locationdDim)
        .group(locationGroup)
        .ordering(function(d) { return -d.value })
        .colors(['#6baed6'])
        .elasticX(true)
        .labelOffsetY(10)
        .xAxis().ticks(4);
		
	// map
	var map = L.map('map');
	var drawMap = function(){

		map.setView([31.75, 110], 4);
		mapLink = '<a href="http://openstreetmap.org">OpenStreetMap</a>';
		L.tileLayer(
			'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				attribution: '&copy; ' + mapLink + ' Contributors',
				maxZoom: 15,
			}).addTo(map);

		// HeatMap
		var geoData = [];
		_.each(allDim.top(Infinity), function (d) {
			geoData.push([d["latitude"], d["longitude"], 1]);
		});
		var heat = L.heatLayer(geoData,{
			radius: 10,
			blur: 20, 
			maxZoom: 1,
		}).addTo(map);

	};
	drawMap();
	
	// redraw function
	dcCharts = [timeChart, genderChart, ageSegmentChart, phoneBrandChart, locationChart];

	_.each(dcCharts, function (dcChart) {
		dcChart.on("filtered", function (chart, filter) {
			map.eachLayer(function (layer) {
			  map.removeLayer(layer)
			}); 
		drawMap();
		});
	});
	dc.renderAll();
	
};

loadData();