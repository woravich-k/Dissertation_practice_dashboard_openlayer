var mymap;
var boroughLyr;
var client_borough;
var client;
var pointLyr;
var addRemovePoint;
//load borough

var vectorSource = new ol.source.Vector({
	url: 'http://woravich-k:4480/getGeoJSON/borough/geom',
	format: new ol.format.GeoJSON()
	// features: (new ol.format.GeoJSON()).readFeatures(geoJSONData,{
      // dataProjection: 'EPSG:4326',
      // featureProjection: 'EPSG:3857'
    // })
	
});


var map = new ol.Map({
	layers: [
		new ol.layer.Tile({
		source: new ol.source.OSM()
		}),
		new ol.layer.Vector({
		source: vectorSource
		})
	],
	target: 'mymap',
	view: new ol.View({
		center: [-11131.95, 6708076.93],
		zoom: 10
	})
});

// a normal select interaction to handle click
var select = new ol.interaction.Select({
	condition: ol.events.condition.never
});
map.addInteraction(select);

var selectedFeatures = select.getFeatures();

// a DragBox interaction used to select features by drawing boxes
var dragBox = new ol.interaction.DragBox({
	condition: ol.events.condition.platformModifierKeyOnly
});

map.addInteraction(dragBox);

dragBox.on('boxend', function() {
// features that intersect the box are added to the collection of
// selected features
	var extent = dragBox.getGeometry().getExtent();
	vectorSource.forEachFeatureIntersectingExtent(extent, function(feature) {
		
		boroughChart.filter(feature.get('borough'));
		// selectedFeatures.push(feature);
	});
});

// clear selection when drawing a new box and when clicking on the map
dragBox.on('boxstart', function() {
	selectedFeatures.clear();
});



map.on('click', function(event) {

    map.forEachFeatureAtPixel(event.pixel, function(feature,layer) {
		if (layer.getSource() === vectorSource){
			boroughChart.filter(feature.get('borough'));
		}
               
        
    });
});

selectedFeatures.on(['add', 'remove'], function() {
	dc.redrawAll();
});




// load graph
function loadGraph(){
	var url = 'http://woravich-k:4480/getGeoJSON/London_price_pp/geom';
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
		// if (client.status == 400){
			// loadGraph();
			// return;
		// }
		//once the data is ready, process the data
		var geoJSONData = client.responseText;
		geoJSONData = JSON.parse(geoJSONData);
		// console.log(geoJSONData)
		
		
		makeGraphs(geoJSONData);
	}
}

var boroughChart;
function makeGraphs(recordsJson) {
	
	var records = recordsJson.features;
	
	// var dateFormat = d3.time.format("%d/%m/%Y");
	var parseTime = d3.timeParse("%d/%m/%Y");
	records.forEach(function(d) {
		// d.properties["date"] = dateFormat.parse(d.properties["date"]);
		d.properties["date"] = parseTime(d.properties["date"]);
	});
	
	
	// data dimension _ crossfilter
	var ndx = crossfilter(records);
	var dateDim = ndx.dimension(function(d) { return d.properties["date"]; });
	var boroughDim = ndx.dimension(function(d) { return d.properties["BOROUGH"]; });
	var boroughDim2 = ndx.dimension(function(d) { return d.properties["BOROUGH"]; });
	var typeDim = ndx.dimension(function(d) { return d.properties["Type"]; });
	var allDim = ndx.dimension(function(d) {return d;});
	
	//group
	var dateGroup = dateDim.group();
	var boroughGroup = boroughDim.group();
	var boroughGroupPrice = boroughDim2.group().reduceSum(function(d){return d.properties["Price"]});
	var typeGroup = typeDim.group();
	var all = ndx.groupAll();
	var all_price = ndx.groupAll().reduceSum(function(d){return d.properties["Price"]});
	
	// first and last timestamps
	var minDate = dateDim.bottom(1)[0].properties["date"];
	var maxDate = dateDim.top(1)[0].properties["date"];
	
	
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
		if (map.getLayers().getArray().indexOf(pointLyr) === -1){
			//add
			var features = [];
			allDim.top(Infinity).forEach(function (d) {
				features.push(new ol.Feature({
					'geometry': new ol.geom.Point(ol.proj.transform([d.geometry.coordinates[0], d.geometry.coordinates[1]],recordsJson.crs.properties.name,'EPSG:3857'))
				}));
			});
			
			var pntSource = new ol.source.Vector({
					features: features,
				});
			pointLyr =  new ol.layer.Vector({
							source: pntSource
						});
			map.addLayer(pointLyr);
		} else {
			map.removeLayer(pointLyr);
		}
	}
	
	// redraw map
	dcCharts = [boroughChart, boroughPriceChart, timeChart, TypeChart];
	
	
	dcCharts.forEach(function (dcChart) {
		dcChart.on("filtered", function (chart, filter) {
			if (chart === boroughChart || chart === boroughPriceChart){
				if (filter == null){
						selectedFeatures.clear();
				} else { 
					vectorSource.forEachFeature(function(feature) {
						if (feature.get('borough') === filter) {
							if (selectedFeatures.getArray().indexOf(feature) == -1){
								selectedFeatures.push(feature);
							} else {
								selectedFeatures.remove(feature);
							}
						}	
					});
				}
			}
			if (map.getLayers().getArray().indexOf(pointLyr) != -1){
				map.removeLayer(pointLyr);
				addRemovePoint();
			}
		});
	});
				// boroughLyr.setStyle(function (feature){
					// if (filter == null){
						// if (feature.properties.selected){
							// feature.properties.selected = !feature.properties.selected;
							// return {
								// weight: 3,
								// color: '#666',
								// dashArray: '',
								// fillOpacity: 0.2,
								// fillColor: '#666'
							// }
						// }
					// } else if (feature.properties["borough"] == filter){
						// feature.properties.selected = !feature.properties.selected;
						// if (feature.properties.selected){
							
							// return {
								// weight: 5,
								// color: '#3388ff',
								// dashArray: '',
								// fillOpacity: 0.2,
								// fillColor: '#3388ff'
							// }
						// } else {
							
							// return {
								// weight: 3,
								// color: '#666',
								// dashArray: '',
								// fillOpacity: 0.2,
								// fillColor: '#666'
							// }
						// }
					// }
					// return;
				// });
			// }
			
			
			// if (mymap.hasLayer(pointLyr)){
				// mymap.removeLayer(pointLyr);
				// addRemovePoint();
				
			// }
		// });
		
	// });
	
	//render dc
	dc.renderAll();
}


loadGraph();
// loadBorough();