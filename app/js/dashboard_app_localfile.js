var mymap;
var boroughLyr;
var client_borough;
var client;
var pointLyr;
var addRemovePoint;
mymap = L.map('mymap').setView([51.4074,-0.1],10);
//load the map	
//load the tiles
L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw',{
	maxZoom: 18,
	attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors,'+'<a href="http://creativecommons.org/licenses/by-sa/2.0/"> CC-BY-SA</a>,'+'imagery &copy; <a href="http://mapbox.com">Mapbox</a>', 
	id: 'mapbox.streets'
	}).addTo(mymap);

//select features
function highlightFeature(e) {
    var layer = e.target;

    layer.setStyle({
        weight: 5,
        color: '#3388ff',
        dashArray: '',
        fillOpacity: 0.2,
		fillColor: '#666'
    });

    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
        layer.bringToFront();
    }
}
function resetHighlight(e) {
	if (!e.target.feature.properties.selected){
		boroughLyr.resetStyle(e.target);
		
		if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
			e.target.bringToBack();
		}
		
	};
}
function zoomToFeature(e) {
	// e.target.feature.properties.selected = !e.target.feature.properties.selected;
	// if (e.target.feature.properties.selected) {
		// e.target.setStyle({
			// fillColor: '#3388ff'
		// });
	// } else {
		// e.target.setStyle({
			// fillColor: '#666'
		// });
	// }
	boroughChart.filter(e.target.feature.properties.BOROUGH);
	dc.redrawAll();
	
    // mymap.fitBounds(e.target.getBounds());
}
function onEachFeature(feature, layer) {
    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click: zoomToFeature
    });
}

	
//load borough
function loadBorough(){
	var url = './data/borough.json';
	client_borough = new XMLHttpRequest();
	
	client_borough.open('GET', url);
	client_borough.onreadystatechange = dataResponse; 
	client_borough.send();
}

//adapted from the practicle codes in the module
//create the code to wait for the response from the data server, and process the response once it is received
function dataResponse(){
//this function listens out for the server to say that the data is ready - i.e. has state 4
	if (client_borough.readyState == 4){
		//once the data is ready, process the data
		var geoJSONData = client_borough.responseText;
		geoJSONData = JSON.parse(geoJSONData);
		
		
		addBorough(geoJSONData);
	}
}

function addBorough(geoJSONData) {
	boroughLyr = L.geoJSON(geoJSONData,{
		style: {color: '#666'},
		onEachFeature: onEachFeature
		}).addTo(mymap);
	mymap.fitBounds(boroughLyr.getBounds());

}






// load graph
function loadGraph(){
	var url = './data/London_price_pp.json';
	client = new XMLHttpRequest();
	
	client.open('GET', url);
	client.onreadystatechange = graphResponse; 
	client.send();
}

//adapted from the practicle codes in the module
//create the code to wait for the response from the data server, and process the response once it is received
function graphResponse(){
//this function listens out for the server to say that the data is ready - i.e. has state 4
	if (client.readyState == 4){
		//once the data is ready, process the data
		var geoJSONData = client.responseText;
		geoJSONData = JSON.parse(geoJSONData);
		
		
		makeGraphs(geoJSONData);
	}
}

var boroughChart;
function makeGraphs(recordsJson) {
	var records = recordsJson.features;
	console.log(records)
	// var dateFormat = d3.time.format("%d/%m/%Y");
	var parseTime = d3.timeParse("%d/%m/%Y");
	records.forEach(function(d) {
		// d["attributes"]["date"] = dateFormat.parse(d["attributes"]["date"]);
		d["attributes"]["date"] = parseTime(d["attributes"]["date"]);
	});
	
	
	// data dimension _ crossfilter
	var ndx = crossfilter(records);
	var dateDim = ndx.dimension(function(d) { return d["attributes"]["date"]; });
	var boroughDim = ndx.dimension(function(d) { return d["attributes"]["BOROUGH"]; });
	var boroughDim2 = ndx.dimension(function(d) { return d["attributes"]["BOROUGH"]; });
	var typeDim = ndx.dimension(function(d) { return d["attributes"]["Type"]; });
	var allDim = ndx.dimension(function(d) {return d;});
	
	//group
	var dateGroup = dateDim.group();
	var boroughGroup = boroughDim.group();
	var boroughGroupPrice = boroughDim2.group().reduceSum(function(d){return d["attributes"]["Price"]});
	var typeGroup = typeDim.group();
	var all = ndx.groupAll();
	var all_price = ndx.groupAll().reduceSum(function(d){return d["attributes"]["Price"]});
	
	// first and last timestamps
	var minDate = dateDim.bottom(1)[0]["attributes"]["date"];
	var maxDate = dateDim.top(1)[0]["attributes"]["date"];
	
	
	// define charts
	var numberRecords = dc.dataCount("#number-records");
	var timeChart = dc.barChart("#time-chart");
	boroughChart = dc.rowChart("#borough-chart");
	var boroughPriceChart = dc.rowChart("#borough-price-chart");
	var totalPrice = dc.numberDisplay("#total-price");
	var TypeChart = dc.pieChart("#type-chart");
	
	//create charts
	boroughChart
        .dimension(boroughDim)
        .group(boroughGroup)
        .height(650)
		.width(320)
		.margins({top: 0, right: 5, bottom: 20, left: 0})
        .elasticX(true)
        .xAxis().ticks(4);
		
	//create charts
	boroughPriceChart
        .dimension(boroughDim2)
        .group(boroughGroupPrice)
        .height(800)
        .elasticX(true)
        .xAxis().ticks(4);
		
	timeChart
		.width(1000)
		.height(140)
		.margins({top: 0, right: 50, bottom: 20, left: 40})
		.dimension(dateDim)
		.group(dateGroup)
		.transitionDuration(500)
		.x(d3.scaleTime().domain([minDate, maxDate]))
		.elasticY(true)
		.yAxis().ticks(4);
	
	TypeChart
		.width(400)
		.height(300)
		.slicesCap(4)
		.innerRadius(100)
		.dimension(typeDim)
		.group(typeGroup)
		.legend(dc.legend())
		// workaround for #703: not enough data is accessible through .label() to display percentages
		.on('pretransition', function(chart) {
			chart.selectAll('text.pie-slice').text(function(d) {
				return d.data.key + ' ' + dc.utils.printSingleValue((d.endAngle - d.startAngle) / (2*Math.PI) * 100) + '%';
			})
		});
		
	numberRecords /* dc.dataCount('.dc-data-count', 'chartGroup'); */
        .dimension(ndx)
        .group(all)
        // (_optional_) `.html` sets different html when some records or all records are selected.
        // `.html` replaces everything in the anchor with the html given using the following function.
        // `%filter-count` and `%total-count` are replaced with the values obtained.
        .html({
            some: '<strong>%filter-count</strong> selected out of <strong>%total-count</strong> records' +
                ' | <a href=\'javascript:dc.filterAll(); dc.renderAll();\'>Reset All</a>',
            all: 'All records selected. Please click on the graph to apply filters.'
        });
	
	totalPrice
		.dimension(ndx)
		.group(all_price)
		.valueAccessor(function(d){return d;})
		.formatNumber(d3.format(","));
	
	
	
	//function add properties (Global variable)
	addRemovePoint = function(){
		if (!mymap.hasLayer(pointLyr)){
			//add
			var markers = [];
			allDim.top(Infinity).forEach(function (d) {
				markers.push(L.circleMarker([d["geometry"]["y"], d["geometry"]["x"]],{radius: 0.1}));
				
			});
			pointLyr = L.featureGroup(markers).addTo(mymap);
		} else {
			mymap.removeLayer(pointLyr);
		}
	}
	
	// redraw map
	dcCharts = [boroughChart, boroughPriceChart, timeChart, TypeChart];
	
	
	dcCharts.forEach(function (dcChart) {
		dcChart.on("filtered", function (chart, filter) {
			if (chart === boroughChart || chart === boroughPriceChart){
				boroughLyr.setStyle(function (feature){
					if (filter == null){
						if (feature.properties.selected){
							feature.properties.selected = !feature.properties.selected;
							return {
								weight: 3,
								color: '#666',
								dashArray: '',
								fillOpacity: 0.2,
								fillColor: '#666'
							}
						}
					} else if (feature.properties.BOROUGH == filter){
						feature.properties.selected = !feature.properties.selected;
						if (feature.properties.selected){
							
							return {
								weight: 5,
								color: '#3388ff',
								dashArray: '',
								fillOpacity: 0.2,
								fillColor: '#3388ff'
							}
						} else {
							
							return {
								weight: 3,
								color: '#666',
								dashArray: '',
								fillOpacity: 0.2,
								fillColor: '#666'
							}
						}
					}
					return;
				});
			}
			
			
			if (mymap.hasLayer(pointLyr)){
				mymap.removeLayer(pointLyr);
				addRemovePoint();
				
			}
		});
		
	});
	
	//render dc
	dc.renderAll();
}


loadGraph();
loadBorough();