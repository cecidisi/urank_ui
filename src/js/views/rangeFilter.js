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

		var margin = { 'top': 10, 'right': 5, 'bottom': 40, 'left': 5 }
		var outerWidth = $root.width();
		var outerHeight = $root.height();
		var width = outerWidth - margin.left - margin.right;
		var height = outerHeight - margin.top - margin.bottom;
		var barColor = 'rgb(66, 146, 198)';
		var barWidth = Math.min(20, Math.round(width/facetData.length))
		// adjust width and lateral margins if too few bars
		if(barWidth == 20) {
			width = barWidth * facetData.length;
			margin.left = (outerWidth - width) / 2;
			margin.right = margin.left;
		}

		var ext = d3.extent(facetData, function(d){ return d.year } );
		var valRange = _.range(ext[0], ext[1]+1)

		var x = d3.scale.ordinal()
			.domain(valRange)
			.rangeBands([0, width], .01)

		// var x = d3.time.scale()
		// 	.domain(d3.extent(facetData, function(d){ return d.year } ))
		// 	.rangeRound([0, width])


		var y = d3.scale.linear()
			.domain([0, d3.max(facetData, function(d){ return d.year })])
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
			.attr('height', outerHeight)
			.append('g')
				.attr('width', width)
				.attr('height', height)
				.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

		// Draw x axis
        svg.append("g")
            .attr("class", axisClass +' '+ xClass)
            .attr("transform", "translate(0," + (height) + ")")
            .call(xAxis)
            .selectAll("text")	
	            .style("text-anchor", "end")
	            .attr("dx", "-.8em")
	            .attr("dy", ".5em")
	            .attr("transform", "rotate(-45)");

        svg.append("g")
	        .attr("class", axisClass +' '+ yClass)
	        .call(yAxis)
	        .selectAll('text');


		// Add bars
		svg.selectAll('rect')
			.data(facetData)
			.enter()
			.append('rect')
				.attr('id', function(d, i){ return 'urank-facet-bar-'+i })
				.attr('class', 'urank-facet-bar')
				.attr('x', function(d){ return x(d.year) })
				.attr('y', 0)
				.attr('width', x.rangeBand())
				.attr('height', function(d){ return y(d.count) })
				.style('fill', barColor)


	}



	// Prototype
	RangeFilter.prototype = {
		build: _build
	}

	return RangeFilter;

})()


module.exports = RangeFilter