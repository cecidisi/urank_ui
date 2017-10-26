var d3 = require('d3')
var _ = require('underscore')

var RangeFilter = (function(){
	var _this, $root;
    // Settings
    var s = {};
    var svgClass = 'urank-rangefilter-svg',
        axisClass = 'urank-rangefilter-axis',
        xClass = 'urank-rangefilter-axis-x',
        yClass = 'urank-rangefilter-axis-y';


	function RangeFilter(params){
		_this = this;
		s = $.extend(true, {
			root: '',
			attr: {},
			cb: {
				onRangeSelected: function(_from, _to){}
			}
		}, params)
		$root = $(s.root)
	}


	var _build = function(facetData){
		
		// facetData = [
		// 	{ year: 2007, count: 10 },
		// 	{ year: 2008, count: 20 },
		// 	{ year: 2009, count: 30 },
		// 	{ year: 2010, count: 10 },
		// 	{ year: 2011, count: 50 },
		// 	{ year: 2012, count: 40 },
		// 	{ year: 2013, count: 70 },
		// 	{ year: 2014, count: 50 },
		// 	{ year: 2015, count: 60 },
		// 	{ year: 2016, count: 80 },
		// 	{ year: 2017, count: 40 }
		// ]

		var svg, gChart, gBrush;
		var margin = { 'top': 10, 'right': 5, 'bottom': 40, 'left': 5 }
		var outerWidth = $root.width();
		var outerHeight = $root.height();
		var width = outerWidth - margin.left - margin.right;
		var height = outerHeight - margin.top - margin.bottom;
		var barColor =  '#dadada';
		var barWidth = Math.min(20, Math.round(width/facetData.length))
		// adjust width and lateral margins if too few bars
		if(barWidth == 20) {
			width = barWidth * facetData.length;
			margin.left = (outerWidth - width) / 2;
			margin.right = margin.left;
		}

		var ext_val = d3.extent(facetData, function(d){ return d.year } );
		var valRange = _.range(ext_val[0], ext_val[1]+1)

		var x = d3.scale.ordinal()
			.domain(valRange)
			.rangeBands([0, width], .01)


		var y = d3.scale.linear()
			.domain([0, d3.max(facetData, function(d){ return d.count })])
			// .domain([0, facetData[facetData.length - 1].count])
			.range([height, 0])
		
		var xAxis = d3.svg.axis()
			.scale(x)
			.orient('bottom')
			// customize ticks

		var yAxis = d3.svg.axis()
			.scale(y)
			.orient('left')
			.tickValues('');

		// Root svg
		svg = d3.select(s.root).append('svg')
			.attr('id', 'urank-range-filter')
			.attr('class', svgClass)
			.attr('width', outerWidth)
			.attr('height', outerHeight);
			
		gChart = svg.append('g')
			.attr('width', width)
			.attr('height', height)
			.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

		// Draw x axis
        gChart.append("g")
            .attr("class", axisClass +' '+ xClass)
            .attr("transform", "translate(0," + (height) + ")")
            .call(xAxis)
            .selectAll("text")	
	            .style("text-anchor", "end")
	            // .attr("dx", "-.8em")
	            // .attr("dy", ".15em")
	            .attr("dx", ".18em")
	            .attr("dy", ".5em")
	            .attr("transform", "rotate(-45)");

        gChart.append("g")
	        .attr("class", axisClass +' '+ yClass)
	        .call(yAxis)
	        .selectAll('text');


		// Add bars
		gChart.selectAll('rect')
			.data(facetData)
			.enter()
			.append('rect')
				.attr('id', function(d, i){ return 'urank-facet-bar-'+i })
				.attr('class', 'urank-facet-bar')
				.attr('x', function(d){ return x(d.year) })
				.attr('width', x.rangeBand())
				.attr('y', function(d){ return y(d.count) })
				.attr('height', function(d){ return height - y(d.count) })
				// .attr('height', function(d){ return height - y(d.count) })
				.style('fill', barColor)

		// BRUSH
		var brushmove = function(){

		}
		var brushend = function(){
			var extent = brush.extent();
			var norm_ext = [extent[0]/width, extent[1]/width]
			var offset_dom = norm_ext.map(function(v){
				return v * (facetData[facetData.length-1].year - facetData[0].year)
			});
			var values = offset_dom.map(function(offset){
				return Math.round(facetData[0].year + offset)
			})
			s.cb.onRangeSelected(values[0], values[1])

		}

	    var brush = d3.svg.brush()
	        .x(x)
	        .extent([0, width])
	        .on("brush", brushmove)
	        .on("brushend", brushend);


		gBrush = svg.append('g')
			.attr('class', 'urank-rangefilter-brush')
			.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
			.append("g")
      			.attr("class", "brush")
      			.call(brush);

  	    gBrush.selectAll(".resize")
			.append("line")
			.attr("y2", height);

		gBrush.selectAll('.extent')
			.style('fill', 'rgb(66, 146, 198)')
			.style('opacity', .4)

	    gBrush.selectAll(".resize")
			.append("path")
			.attr("d", d3.svg.symbol().type("triangle-up").size(20))
			.attr("transform", function(d,i) { 
				return i ? 
					"translate(" + -4 + "," + (height/2) + ") rotate(270)" : 
					"translate(" + 4  + "," + (height/2) + ") rotate(90)"; 
			});

	    gBrush.selectAll("rect")
			.attr('height', height);

	};




	var _restore = function(){



	}



	// Prototype
	RangeFilter.prototype = {
		build: _build,
		restore: _restore
	}

	return RangeFilter;

})()


module.exports = RangeFilter