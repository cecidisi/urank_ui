var utils = require('../helper/utils')

DataConnector = (function(){
	var _this;

	function DataConnector(options){
		this.urls = options.urls;
		this.path_to_results = options.path_to.results;
		this.path_to_count = options.path_to.count;
		_this = this;
	}


	var sendRequest = function(options, onDone, onFail){
		var request_options = $.extend(true, {
			'url' : '',
			'type': 'GET'
		}, options);
		console.log(request_options);
		onDone = onDone || function(data){};
		onFail = onFail || function(){};
		if(!request_options.url || request_options.url === '') return { 'message': 'No URL set' };
		var timelapse = $.now()
		$.ajax(request_options)
		.fail(function(jqXHR, textStatus){
	        console.log('DataConnector ERROR ' + request_options.type + ' ' + request_options.url);
	        // console.log(jqXHR)
	        onFail();
	    }).done(function(resp) {
	        timelapse = $.now() - timelapse
	        console.log('DataConnector: successful request ' + request_options.type + ' ' + request_options.url + ' (' + timelapse + ' ms)');
	        var results = utils.getDeepVal(resp, _this.path_to_results);
	        var count = utils.getDeepVal(resp, _this.path_to_count)
	        onDone(results, count);
	    });

	};


	var postUrank = function(url, data, onDone){
		console.log('DataConnector: Start request --> ' + data.operation);
		sendRequest({ 
			'type': 'POST',
			'url': url, 
			'data':  JSON.stringify(data),
			'contentType': 'application/json; charset=utf-8'
		}, onDone);
	}

	var replaceParamsInUrl = function(url, params) {
		if(!url) return;
		Object.keys(params).forEach(function(key){
			url = url.replace('['+key+']', params[key])
		})
		return url;
	}


	/*********************************************************/
	/******			   Prototype Methods 				 *****/
	/*********************************************************/

	var getData = function(onDone) {
		sendRequest({ 'url': _this.urls.get_data }, onDone);
	};

	var getKeywords = function(onDone) {
		sendRequest({ 'url': _this.urls.get_keywords }, onDone);
	};

	var getTags = function(onDone){
		sendRequest({ 'url': _this.urls.get_tags }), onDone;
	};

	var getUsertags = function(onDone){
		sendRequest({ 'url': _this.urls.get_usertags }, onDone);
	};

	var getNeighbors = function(onDone){
		sendRequest({ 'url': _this.urls.get_neighbors }, onDone);
	};

	var updateRanking = function(params, onDone) {
		var url = this.urls.update_ranking || this.urls.urank;
		var data = $.extend(true, { 'operation': 'update' }, params);
		postUrank(url, data, onDone);
	};

	var clearRanking = function(onDone) {
		var url = this.urls.urank || this.urls.clear_ranking;
		var data = { 'operation': 'clear' };
		postUrank(url, data, onDone);
	};

	var showMoreData = function(params, onDone){
		var url = this.urls.show_more_data || this.urls.urank;
		url = replaceParamsInUrl(url, params);
		sendRequest({ 'url': url }, onDone);
		
		// var data = { 'operation': 'show_more' };
		// postUrank(url, done, onDone);
	};

	var getDocumentDetails = function(params, onDone){
		if(this.urls.get_document_details) {
			var url = replaceParamsInUrl(this.urls.get_document_details, params)
			sendRequest({ 'url': url }, onDone)
		} else if(this.urls.urank) {
			var url = this.urls.urank;
			var data = $.extend(true, { 'operation': 'get_document_details' }, params);
			postUrank(url, data, onDone);
		}
	};

	var getKeyphrases = function(params, onDone){
		var url = replaceParamsInUrl(this.urls.get_keyphrases, params);		
		sendRequest({ 'url': url }, onDone)
	};

	var getFacets = function(params, onDone) {
		var url = replaceParamsInUrl(this.urls.get_facets, params);
		sendRequest({ 'url': url }, onDone);
	};


	var searchFeature = function(params, onDone) {
		var url = replaceParamsInUrl(this.urls.search_features, params);
		sendRequest({ 'url': url }, onDone)
	};


	var filterByYear = function(params, onDone){
		var url = replaceParamsInUrl(this.urls.filter_articles_by_year, params);
		sendRequest({ 'url': url }, onDone)
	}


	DataConnector.prototype = {
		getData: getData,
		getKeywords: getKeywords,
		getTags: getTags,
		getUsertags: getUsertags,
		getNeighbors: getNeighbors,
		getKeyphrases: getKeyphrases,
		getFacets: getFacets,
		updateRanking: updateRanking,
		clearRanking, clearRanking,
		showMoreData : showMoreData,
		getDocumentDetails: getDocumentDetails,
		searchFeature: searchFeature,
		filterByYear: filterByYear
	};

	return DataConnector;

})()


module.exports = DataConnector;