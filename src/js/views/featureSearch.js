

var FeatureSearch = (function() {

	var _this, $root;
	var s = {};

	function FeatureSearch(params){
		_this = this;
		s = $.extend({
            root: '',
            options: {
				'type': ''
			},
			cb: {
				onFeatureTyping: function(feature_type, text){},
				onFeatureSearched: function(feature_type, index, name){}
			}
        }, params);

		$root = $(s.root)
	}


	var build = function() {
		$root.on({
			input : function(evt){
				evt.stopPropagation();
				console.log('Text = ' + $(this).val());
				s.cb.onFeatureTyping(s.options.type, $(this).val())
			},
			focus: function(evt){
				evt.stopPropagation()
				this.value = ''
				console.log(this.value = '')
			}
		})
		.autocomplete({
			source: [],
			select: function(evt, ui){
				console.log(ui.item)
				s.cb.onFeatureSearched(s.options.type, ui.item)
				// s.cb.onFeatureSearched(s.options.type, ui.item.idx, ui.item.value)
				this.value = ''
			},
			close: function(el) {
				el.target.value = '';
			}
		})
	};


	var populateFeatureMenu = function(feature_type, feature_list){
		// console.log(feature_list)
		$root.autocomplete('option', 'source', feature_list)
	};




	FeatureSearch.prototype = {
		build: build,
		populateFeatureMenu: populateFeatureMenu
	}



	return FeatureSearch;
})()

module.exports = FeatureSearch;