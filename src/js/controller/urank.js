// var $ = require('jquery');
var VIEWS = require('../config/views');
var Config = require('../config/config');
var DataConnector = require('../model/dataConnector');
var KeywordExtractor = require('../model/keywordExtractor');
var RankingModel = require('../model/rankingModel');
var ContentList = require('../views/contentList');
var DocViewer = require('../views/docViewer');
var TagBox = require('../views/tagBox');
var TagCloud = require('../views/tagCloud');
var UsertagBox = require('../views/usertagBox');
var VisCanvas = require('../views/visCanvas');
var NeighborsCloud = require('../views/neighborsCloud');
var FeatureSearch = require('../views/featureSearch')
var RangeFilter = require('../views/rangeFilter')



var Urank = (function() {
    var _this, config, views, colorScales, callbacks, rankingConf, attr;
    var dataConn, rankingModel, selectedId, data, keywordExtractor, tags;
    
    ////////////////////////////////////////////////////////////////////////////////////////
    //  METHODS PASSED TO VIEWS AND CALLED UPON EVENT OCCURRENCES
    ////////////////////////////////////////////////////////////////////////////////////////
    var EVTHANDLER = {
        // SEARCH INPUT
        onFeatureTyping: function(feature_type, text) {
            if(text !== '') {
                URANK.searchFeature(feature_type, text);
                callbacks.onFeatureTyping.call(this, feature_type, text)    
            }
        },
        onFeatureSearched: function(feature_type, index, name){
            URANK.addNewFeature(feature_type, index, name);

        },
        // TAGCLOUD
        onTagSelected: function(index, id, is_multiple) {
            var stem = _this.keywords[index].stem;
            var term = _this.keywords[index].term;
            var tag_color =  getSelectedTagColor(stem, 'keyword');
            var tag = { type: 'keyword', id: id, index: index, stem: stem, color: tag_color, weight: 1, name: term };
            // { type: 'keyword', id: id, index: index, color: color, weight: 1 };
            views.tagBox.appendTag(tag);
            views.tagCloud.updateClonOfDroppedTag(index, id, tag_color);
            _this.selectedFeatures.keywords.push(tag);
            
            // if(!is_multiple) {
            URANK.update(_this.selectedFeatures);
            callbacks.onTagSelected.call(this, tag);
            // }
        },
        onMultipleTagsSelected: function(tags_arr) {
            // var droppedTags = []
            tags_arr.forEach(function(tag) {
                EVTHANDLER.onTagSelected(tag.index, tag.id, true);
                // droppedTags.push(tag);
            });
            // Add CALLBACK
        },

        onKeyphraseSelected: function(phrase){
            var tag = { 
                'type': 'keyword', 
                'id': phrase.id, 
                'name': phrase.phrase,
                'stem': phrase.stems, 
                'color': getSelectedTagColor(phrase.stems, 'keyword'), 
                'weight': 1,
                'is_new': true
            };
            console.log(tag)
            views.tagBox.appendTag(tag);
            _this.selectedFeatures.keywords.push(tag)
            URANK.update(_this.selectedFeatures)
        },

        onKeywordEntered: function(keyword){
            views.tagCloud.focusTag(keyword);
            callbacks.onKeywordEntered.call(this, keyword);
        },

        onTagFrequencyChanged: function(min, max){
            views.tagCloud.showTagsWithinRange(min, max)
            callbacks.onTagFrequencyChanged.call(this, min, max);
        },

        onShowMoreClicked: function(){
            URANK.showMore();
        },

        onTagInCloudClick: function(index, id) {
            // FIX HERE --> request bearing documents to server
            var idsArray = _this.keywords[index].inDocument;
            views.contentList.highlightListItems(idsArray);
            views.visCanvas.highlightItems(idsArray).resize(views.contentList.getListHeight());
            var tag = { index: index, id: id, term: _this.keywords[index].term }
            callbacks.onTagInCloudClick.call(this, tag);
        },

        // TAG BOX
        onTagDeleted: function(tag) {
            
            var featureType = tag.type + 's'
            var indexToDelete = _.findIndex(_this.selectedFeatures[featureType], function(t){
                // return t.id.toString() === tag.id.toString();
                return t.name === tag.name;
            });
            // _this.selectedKeywords.splice(indexToDelete, 1);
            _this.selectedFeatures[featureType].splice(indexToDelete, 1);
            if(featureType === 'keywords') {
                views.tagCloud.restoreTag(tag, tag.index);
            } else if (featureType === 'neighbors') {
                views.neighborsCloud.restoreTag(tag.index, tag.id)
            }
            views.tagBox.deleteTag(tag);
            URANK.update(_this.selectedFeatures);
            callbacks.onTagDeleted.call(this, tag);
        },

        onTagWeightChanged: function(tag /*index, id, weight*/){
            var featureType = tag.type + 's'
            var indexToUpdate = _.findIndex(_this.selectedFeatures[featureType], function(t){
                // return t.id.toString() === tag.id.toString();
                return t.name === tag.name;
            });
            _this.selectedFeatures[featureType][indexToUpdate].weight = tag.weight;            
            URANK.update(_this.selectedFeatures);            
            callbacks.onTagWeightChanged.call(this, tag);
        },

        onTagInCloudMouseEnter: function(index, id) {
            views.tagCloud.hoverTag(_this.keywords[index], index);
            URANK.loadKeyphrases(index, id);
            // var tag = { index: index, id: id, term: _this.keywords[index].term }
            // callbacks.onTagInCloudMouseEnter.call(this, tag);
        },

        onTagInCloudMouseLeave: function(index, id) {
            views.tagCloud.unhoverTag(_this.keywords[index], index);
            // var tag = { index: index, id: id, term: _this.keywords[index].term }
            // callbacks.onTagInCloudMouseLeave.call(this, tag);
        },

        // FACET FILTERING
        onRangeSelected: function(from, to){
            URANK.filterByYear(from, to)
        },

        // USERTAGS
        onUsertagSelected: function(index, id) {
            var color =  getSelectedTagColor(_this.usertags[index].tag, 'usertag');
            var usertag = { type: 'usertag', id: id, index: index, color: color, weight: 1 };
            // _this.selectedUsertags.push(usertag);
            _this.selectedFeatures.usertags.push(usertag);
            views.usertagBox.selectUsertag(index, id, color);
            views.tagBox.appendTag(usertag);
        },
        onUsertagMouseEnter: function(index, id) {
            views.usertagBox.onUsertagMouseEnter(index, id);
        },

        onUsertagMouseLeave: function(index, id) {
            views.usertagBox.onUsertagMouseLeave(index, id);
        },

        // NEIGHBOR TAGS
        onNeighborTagSelected: function(index, id) {
            var tag_name = _this.neighbors[index].neighbor.name;
            var tag_color =  getSelectedTagColor(tag_name, 'neighbor');
            var neighbortag = { type: 'neighbor', id: id, index: index, name: tag_name, color: tag_color, weight: 1 };
            // _this.selectedNeighbors.push(neighbortag);
            _this.selectedFeatures.neighbors.push(neighbortag);
            views.neighborsCloud.selectNeighborTag(index, id, tag_color);
            views.tagBox.appendTag(neighbortag);
            URANK.update(_this.selectedFeatures);
            callbacks.onTagSelected.call(this, neighbortag);
        },
        onNeighborTagMouseEnter: function(index, id) {
            views.neighborsCloud.onNeighborTagMouseEnter(index, id);
        },

        onNeighborTagMouseLeave: function(index, id) {
            views.neighborsCloud.onNeighborTagMouseLeave(index, id);
        },

        // TAGCLOUD
        onTagInBoxMouseEnter: function(index) {
            // TODO
            callbacks.onTagInBoxMouseEnter.call(this, index);
        },

        onTagInBoxMouseLeave: function(index) {
            // TODO
            callbacks.onTagInBoxMouseLeave.call(this, index);
        },

        onTagInBoxClick: function(index) {
            callbacks.onTagInBoxClick.call(this, index);
        },
        // RANKING VIEW OR CONTENT LIST
        onItemClicked : function(documentId, index) {
            URANK.showDocument(documentId, index);
        },

        onItemMouseEnter: function(documentId, index) {
            views.contentList.hover(documentId, index);
            views.visCanvas.hoverItem(documentId, index);
            callbacks.onItemMouseEnter.call(this, { index: index, id: documentId, title: data[index][attr.title] });
        },

        onItemMouseLeave: function(documentId, index) {
            views.contentList.unhover(documentId, index);
            views.visCanvas.unhoverItem(documentId, index);
            callbacks.onItemMouseLeave.call(this, { index: index, id: documentId, title: data[index][attr.title] });
        },

        onFaviconClicked: function(documentId, index, state){
            views.contentList.toggleFavicon(documentId, state);
            callbacks.onFaviconClicked.call(this, { index: index, id: documentId, title: data[index][attr.title], state: state });
        },

        onWatchiconClicked: function(documentId, index) {
            views.contentList.toggleWatchListItem(documentId, index);
            callbacks.onWatchiconClicked.call(this, { index: index, id: documentId, title: data[index][attr.title] });
        },

        onDocViewerHidden: function() {
            if(selectedId) {
                selectedId = undefined;
                callbacks.onDocViewerHidden();
            }
            
            views.docViewer.clear();
            views.contentList.deselectAllListItems();
            views.visCanvas.deselectAllItems();
        },

        onRootMouseDown: function(event){
            event.stopPropagation();
            if(event.which == 1) {
                views.tagCloud.clearEffects();
            }
        },

        onRootClick: function(event) {
            if(event.which == 1) {
                views.contentList.clearEffects();
                views.visCanvas.clearEffects().resize(views.contentList.getListHeight());
                views.docViewer.clear();
            }
        },

        onParallelBlockScrolled: function(sender, offset) {
            if(sender === views.contentList)
                views.visCanvas.scrollTo(offset);
            else if(sender == views.visCanvas)
                views.contentList.scrollTo(offset);
        },

        onResize: function(event) {
            views.visCanvas.resize();
        },

        onKeyDown: function(event){
            if(event.keyCode === 27)
                EVTHANDLER.onDocViewerHidden();
        },

        onRankingModeChange: function(mode) {
            console.log('rank by = ' + mode);
            setTimeout(function(){
                if(rankingConf.rank_by !== mode) {
                    rankingConf.rankBy = mode;
                    views.tagBox.updateRankingMode(mode);
                    // if(_this.selectedKeywords.length > 0)
                    URANK.update(_this.selectedFeatures);
                }
            }, 0);
        },

        onRankingWeightChange: function(rWeight) {
            var indexMapping = {}
            rankingConf.rs.forEach(function(conf){
                if(conf.name === 'CB') {
                    conf.weight = 1.0 - parseFloat(rWeight)
                } else {
                    conf.weight = parseFloat(rWeight)
                }
            })
            setTimeout(function() {
                // rankingConf.rs.CB = parseFloat(rWeight);
                // rankingConf.rs.CF = parseFloat(1-rWeight);
                URANK.update(_this.selectedFeatures);
                callbacks.onRankingWeightChanged.call(this, rWeight);
            }, 0);
        },

        onReset: function(event) {
            if(event) event.stopPropagation();
            URANK.reset();
        },

        onRatingClicked: function(documentId, index, rating){
            callbacks.onRatingClicked.call(this, documentId, index, rating);
        }
    };

    ////////////////////////////////////////////////////////////////////////////////
    // URANK  FUNCTIONS
    ////////////////////////////////////////////////////////////////////////////////
    var URANK = {
        
        // Initialize views
        initViews:  function(_config){
            var viewsConf = {
                contentList: {
                    root: _config.elem.contentListRoot,    
                    attr : _config.dataAttr,
                    options : _config.contentList,
                    cb : {
                        onItemClicked: EVTHANDLER.onItemClicked,
                        onItemMouseEnter: EVTHANDLER.onItemMouseEnter,
                        onItemMouseLeave: EVTHANDLER.onItemMouseLeave,
                        onFaviconClicked: EVTHANDLER.onFaviconClicked,
                        onWatchiconClicked: EVTHANDLER.onWatchiconClicked,
                        onScroll: EVTHANDLER.onParallelBlockScrolled,
                        onRatingClicked: EVTHANDLER.onRatingClicked
                    }
                },

                tagCloud: {
                    root: _config.elem.tagCloudRoot,
                    // view: _config.tagCloud.view,  //VIEWS.TAGCLOUD[_config.tagCloud.module],
                    attr : _config.dataAttr,
                    options : $.extend(true, _config.tagCloud, _config.rankingRepresentation),
                    cb : {
                        onKeywordEntered: EVTHANDLER.onKeywordEntered,
                        onTagFrequencyChanged: EVTHANDLER.onTagFrequencyChanged,
                        onTagInCloudMouseEnter: EVTHANDLER.onTagInCloudMouseEnter,
                        onTagInCloudMouseLeave: EVTHANDLER.onTagInCloudMouseLeave,
                        // details-on-demand click
                        onTagInCloudClick: EVTHANDLER.onTagInCloudClick,
                        // click to update ranking
                        onTagSelected: EVTHANDLER.onTagSelected,
                        // keyphrase clicked in dialog
                        onKeyphraseSelected: EVTHANDLER.onKeyphraseSelected
                    }
                },

                tagBox: {
                    root: _config.elem.tagBoxRoot,
                    // options: $.extend(true, {
                    //     useHybridHeader : _config.rankingModel.rs.CB.active && _config.rankingModel.rs.TU.active
                    // }, _config.tagBox, _config.rankingRepresentation),
                    options: _config.tagBox,
                    cb : {
                        onModeChanged: EVTHANDLER.onRankingModeChange,
                        onRankingWeightChanged: EVTHANDLER.onRankingWeightChange,
                        onTagSelected: EVTHANDLER.onTagSelected,       // triggered on atg dropped
                        onMultipleTagsSelected: EVTHANDLER.onMultipleTagsSelected,
                        onTagDeleted: EVTHANDLER.onTagDeleted,
                        onTagWeightChanged: EVTHANDLER.onTagWeightChanged,
                        onTagInBoxMouseEnter: EVTHANDLER.onTagInBoxMouseEnter,
                        onTagInBoxMouseLeave: EVTHANDLER.onTagInBoxMouseLeave,
                        onTagInBoxClick: EVTHANDLER.onTagInBoxClick,
                        onReset: EVTHANDLER.onReset
                    }
                },

                visCanvas: {
                    root: _config.elem.visCanvasRoot,
                    // view : _config.visCanvas.view, //VIEWS.VISCANVAS[_config.visCanvas.module],
                    attr : _config.dataAttr,
                    options : $.extend(true, _config.visCanvas, _config.rankingRepresentation),
                    cb : {
                        onItemClicked: EVTHANDLER.onItemClicked,
                        onItemMouseEnter: EVTHANDLER.onItemMouseEnter,
                        onItemMouseLeave: EVTHANDLER.onItemMouseLeave,
                        onShowMoreClicked: EVTHANDLER.onShowMoreClicked,
                        onScroll: EVTHANDLER.onParallelBlockScrolled
                    }
                },

                docViewer: {
                    root: _config.elem.docViewerRoot,
                    attr : _config.dataAttr,
                    options : _config.docViewer,
                    cb :{
                        onDocViewerHidden: EVTHANDLER.onDocViewerHidden    
                    }
                },

                usertagBox : {
                    root: _config.elem.usertagBox,
                    attr: _config.attr,
                    options: _config.usertagBox,
                    cb : {
                        onUsertagMouseEnter: EVTHANDLER.onUsertagMouseEnter,
                        onUsertagMouseLeave: EVTHANDLER.onUsertagMouseLeave,
                        onUsertagSelected: EVTHANDLER.onUsertagSelected
                    }
                },

                neighborsCloud : {
                    root: _config.elem.neighborscloudRoot,
                    attr: _config.attr,
                    options: _config.neighborscloud,
                    cb : {
                        onNeighborTagMouseEnter: EVTHANDLER.onNeighborTagMouseEnter,
                        onNeighborTagMouseLeave: EVTHANDLER.onNeighborTagMouseLeave,
                        onNeighborTagSelected: EVTHANDLER.onNeighborTagSelected
                    }
                },

                featureSearch: {
                    root: _config.elem.searchInputRoot,
                    options: _config.searchInput,
                    cb: {
                        onFeatureTyping: EVTHANDLER.onFeatureTyping,
                        onFeatureSearched: EVTHANDLER.onFeatureSearched
                    }
                },

                rangeFilter: {
                    root: _config.elem.rangeFilterRoot,
                    cb: {
                        onRangeSelected: EVTHANDLER.onRangeSelected
                    }
                }
            };

            views = {
                contentList   : new ContentList(viewsConf.contentList),
                tagCloud      : new TagCloud(viewsConf.tagCloud),
                tagBox        : new TagBox(viewsConf.tagBox),
                visCanvas     : new VisCanvas(viewsConf.visCanvas),
                docViewer     : new DocViewer(viewsConf.docViewer),
                usertagBox    : new UsertagBox(viewsConf.usertagBox),
                neighborsCloud: new NeighborsCloud(viewsConf.neighborsCloud),
                featureSearch : new FeatureSearch(viewsConf.featureSearch),
                rangeFilter   : new RangeFilter(viewsConf.rangeFilter)
            }

            //  Bind event handlers to resize window and undo effects on random clicks
            $(window).off('resize', EVTHANDLER.onResize).resize(EVTHANDLER.onResize);
            $(document).off('keydown', EVTHANDLER.onKeyDown).on('keydown', EVTHANDLER.onKeyDown);
            $(_config.elem.root).off({
                'mousedown': EVTHANDLER.onRootMouseDown,
                'click': EVTHANDLER.onRootClick
            }).on({
                'mousedown': EVTHANDLER.onRootMouseDown,
                'click': EVTHANDLER.onRootClick
            });
        },

        loadData: function(_data){
            data = _data.slice();
            // EVTHANDLER.loadData(_data);
            console.log('Loaded data = ' + _data.length)
            console.log(data[0])
            //Start ranking model (REPLACE)     
            rankingModel.clear().setData(data);    
            //Build views with data and/or keywords
            views.contentList.build(data, views.tagBox.getHeight());
            views.visCanvas.build(data, views.contentList.getListHeight());
            views.featureSearch.build();
        },

        // Load keywords in tag cloud
        loadKeywords: function(_keywords) {
            _this.keywords = _keywords;
            views.tagCloud.build(_this.keywords, data, colorScales.keyword);
        },

        // Load keywords synchronously with clint-side keyword extractor
        loadKeywordsSync: function(){
            var keywordExtractor = new KeywordExtractor(confKeywordExt);
            //  Clean documents and add them to the keyword extractor
            data.forEach(function(d, i){
                d.index = i;
                d[attr.title] = d[attr.title].clean();
                // var attr_desc = !attr.description_clean.isEmpty() ? attr.description_clean : attr.description;
                // d[attr_desc] = d[attr.description].clean();
                // var text = (d[attr_desc]) ? d[attr.title] +'. '+ d[attr_desc] : d[attr.title];
                var text = d[attr.title];
                keywordExtractor.addDocument(text.removeUnnecessaryChars(), d[attr.id]);
            });

            //  Extract collection and document keywords
            keywordExtractor.processCollection();

            // var kwExt = cleanAndExtractKeywords(data, config.keywordExtractor);
            //  Assign document keywords
            data.forEach(function(d, i){
                d.keywords = keywordExtractor.listDocumentKeywords(i);
            });
            //  Assign collection keywords and set other necessary variables
            _keywords = keywordExtractor.getCollectionKeywords();
            this.loadKeywords(_keywords);
        },

        // Load document tags (unused)
        loadTags: function(_tags){
        },

        // Load user tags (from user model)
        loadUserTags: function(_usertags) {
            _this.usertags = _usertags;
            views.usertagBox.build(_this.usertags, colorScales.usertag);
        },

        loadNeighbors: function(_neighbors) {
            // TODO
            _this.neighbors = _neighbors
            console.log(_this.neighbors[0])
            views.neighborsCloud.build(_this.neighbors, colorScales.neighbor)
        },

        loadKeyphrases: function(index, id) {
            // keyphrases already in memory
            if(_this.keywords[index].phrases) {
                console.log('Phrases in memory: keyword id = ' + id + '; term = ' + _this.keywords[index].term);            
                views.tagCloud.showKeyphrases(index, id, _this.keywords[index].phrases);
            }
            // Fetch keyphrases for current keyword
            else {
                console.log('Fetching phrases form server: keyword id = ' + id + '; term = ' + _this.keywords[index].term)
                dataConn.getKeyphrases({ 'kw_id': id }, function(keyphrases){
                    views.tagCloud.showKeyphrases(index, id, keyphrases);
                    _this.keywords[index].phrases = keyphrases;
                })
            }
        },

        // Generalize for generic facets
        loadFacets: function(_facetData){
            views.rangeFilter.build(_facetData)
        },

        // Update ranking
        update: function(_selectedFeatures) {
            // _this.selectedKeywords = _selectedKeywords || _this.selectedKeywords;
            _this.selectedFeatures = _selectedFeatures
            console.log(rankingConf);

            var emptyFeat = true;
            for(var feature in _this.selectedFeatures) {
                if(_this.selectedFeatures[feature].length){
                    emptyFeat = false;
                }
            }
            if(emptyFeat) {
                return URANK.reset();
            }
            // Update ranking config
            var params = {
                user: _this.user,
                rs_conf: rankingConf,
                features: _this.selectedFeatures,
                decoration: config.contentList.aes.textDecoration
            };

            rankingModel.update(params, function(_ranking, _status, _totalCount){
                data = _ranking;
                status = _status;
                totalCount = _totalCount;
                // Update views
                views.contentList.update({ 
                    ranking: data.slice(),
                    status: status,
                    totalCount: totalCount
                });
                views.visCanvas.update({
                    status: status,
                    ranking: data,
                    conf: rankingConf,
                    totalCount: totalCount,
                    // query: _this.selectedKeywords,
                    features: _this.selectedFeatures,
                    // query: _this.selectedFeatures.keywords,
                    colorScale: colorScales.query,
                    listHeight: views.contentList.getListHeight()
                });
                views.docViewer.clear();
                views.tagCloud.clearEffects();
                // Callback specified by main.js
                // callbacks.onUpdate.call(this, data, _this.selectedKeywords, status);
            });
        },

        // Show more data ata the bottom
        showMore: function(){
            console.log('Current count = ' + data.length)
            dataConn.showMoreData({ 
                'user_id': _this.user,
                'current_count': data.length
            }, function(moreData){
                console.log('Received ' + moreData.length + ' more results')
                views.contentList.showMoreData(moreData);
                views.visCanvas.showMoreData({
                    'data': moreData,
                    'listHeight': views.contentList.getListHeight()
                });

                data = data.concat(moreData);
            })

        },

        // Show clicked document
        showDocument: function(documentId, index) {
            selectedId = documentId;
            views.contentList.selectListItem(documentId, index);
            views.visCanvas.selectItem(documentId, index);
            views.tagCloud.clearEffects();
            // Fetch pretty title and abstract
            var params = {
                doc_id: documentId, 
                doc_index: index, 
                decoration: config.docViewer.aes.textDecoration
            };
            // console.log('index = '+index);
            // console.log('id = ' + documentId);
            dataConn.getDocumentDetails(params, function(doc) {
                views.docViewer.showDocument(doc);
                callbacks.onItemClicked.call(this, { index: index, id: documentId, title: data[index][attr.title] });
            });
        },
            
        // Reset
        reset: function(){
            views.contentList.reset();
            views.tagBox.reset();
            //tagCloud.reset();
            views.visCanvas.reset();
            views.docViewer.clear();
            for(var feature in _this.selectedFeatures){
                _this.selectedFeatures[feature].forEach(function(tag, i){
                    setTimeout(function(){
                        if(feature === 'keywords') {
                            views.tagCloud.restoreTag(tag.index, tag.id);    
                        } else if(feature === 'neighbors') {
                            views.neighborsCloud.restoreTag(tag.index, tag.id)
                        } else if (feature === 'usertags') {
                            views.usertagBox.restoreTag(tag.index, tag.id);
                        }
                        views.tagBox.deleteTag(tag);
                        
                    }, (i+1)*50);
                });    
            }
            
            // _this.selectedKeywords = [];
            _this.selectedFeatures.keywords = [];
            dataConn.getData(URANK.loadData)
            callbacks.onReset.call(this);
        },

        searchFeature(feature_type, text) {
            dataConn.searchFeature({ 'feature_type': feature_type, 'text': text }, 
                function(feature_list) {
                    _this.searchedFeatures = feature_list.slice();
                    feature_list = feature_list.map(function(f, i){
                        return { label: f.term, idx: i }
                    });
                    views.featureSearch.populateFeatureMenu(feature_type, feature_list);
                }
            )
        },

        addNewFeature: function(feature_type, index, name) {
            if(feature_type == 'keyword') {
                // Update keyphrases for newly added keyword
                var keyword = _this.searchedFeatures[index]
                dataConn.getKeyphrases({ 'kw_id': keyword.id }, function(keyphrases){
                    keyword.phrases = keyphrases;
                    _this.keywords.push(keyword);
                    // k, i, prepend = true, animate = true
                    views.tagCloud.addTag(keyword, _this.keywords.length-1, true, true)

                    var obj = { 'id': keyword.id, 'index': _this.keywords.length-1, 'name': name }
                    callbacks.onFeatureSearched(obj)
                })                
            }

        },

        filterByYear: function(from_year, to_year) {
            dataConn.filterByYear({
                'from_year': from_year , 
                'to_year': to_year}, function(_ranking){
                    data = _ranking;
                    // status = _status;
                    // Update views
                    views.contentList.update({ 
                        ranking: data.slice(),
                        status: status
                    });
                    views.visCanvas.update({
                        status: status,
                        ranking: data.slice(),
                        conf: rankingConf,
                        // query: _this.selectedKeywords,
                        features: _this.selectedFeatures,
                        // query: _this.selectedFeatures.keywords,
                        colorScale: colorScales.query,
                        listHeight: views.contentList.getListHeight()
                    });
                    views.docViewer.clear();
                    views.tagCloud.clearEffects();

                    callbacks.onFacetFiltered.call(this, { 'type': 'year', 'value': from_year+'-'+to_year })
                })

        }

    }



    ////////////////////////////////////////////////////////////////////////////////
    // INTERNAL FUNCTIONS
    ////////////////////////////////////////////////////////////////////////////////

    var getOrdinalColorScale = function(colors, numCategories) {
        numCategories = numCategories || colors.length;
        if(colors.length > numCategories) {
            colors = colors.slice(colors.length-numCategories, colors.length);
        }
        // if numCategories > 0, preset domain, otherwise it's updated on-demand (e.g. query terms)
        if(numCategories)
            return d3.scale.ordinal().domain(d3.range(0, numCategories, 1)).range(colors);  
        return d3.scale.ordinal().range(colors);
    };


    var getSelectedTagColor = function(name, type){
        var color;
        if(config.rankingRepresentation.split_by === 'rs') {
            if(type === 'keyword') {
                color = colorScales.keyword(name);
            } else if(type === 'usertag') {
                color = colorScales.usertag(name);
            } else if(type === 'neighbor') {
                color = colorScales.neighbor(name);
            }
        } else if(config.rankingRepresentation.split_by === 'feature') {
            color = colorScales.query(name);
        }
        return color;
    }


    ////////////////////////////////////////////////////////////////////////////////////////
    // CONSTRUCTOR
    ////////////////////////////////////////////////////////////////////////////////////////
    function Urank(options) {
        _this = this;
        data = [];
        this.user = '';
        this.keywords = [];
        this.usertags = [];
        this.neighbors = [];
        this.selectedKeywords = [];
        this.selectedUsertags = [];
        this.selectedNeighbors = [];
        this.selectedFeatures = {}; // keywords, neighbors, usertags, ...
        this.searchedFeatures = [];
        selectedId = undefined;

        // Extend config.js with custom options
        config = $.extend(true, Config, options || {});
        dataConn = new DataConnector(config.dataConnector);
        rankingModel = new RankingModel(config.rankingModel, dataConn);
        Object.keys(config.features).forEach(function(feature){
            _this.selectedFeatures[feature] = [];
        });
    
        attr = config.dataAttr;
        callbacks = config.callbacks;
        colorScales = {
            keyword : getOrdinalColorScale(config.colors.keyword, config.tagCloud.numCategories),
            usertag: getOrdinalColorScale(config.colors.usertag),
            neighbor: getOrdinalColorScale(config.colors.neighbor),
            query : getOrdinalColorScale(config.colors.query, 0)
        };
        rankingConf = config.rankingModel;
        console.log('Ranking Configuration')
        console.log(rankingConf);
        URANK.initViews(config);
    }

    ////////////////////////////////////////////////////////////////////////////////////////
    // PROTOTYPE METHODS
    ////////////////////////////////////////////////////////////////////////////////////////
    var setUser = function(user){
        this.user = user;
    }

    var load = function(_data) {
        views.tagBox.build(rankingConf);
        views.docViewer.build();
        // LOAD DOCUMENTS
        if(_data) {
            URANK.loadData(_data)
        } else {
            dataConn.getData(URANK.loadData);
        }
        // LOAD KEYWORDS
        if(config.features.keywords) {
            // ASYNC load if local keyword extractor is disabled
            if(config.keywordExtractor.useLocal) {
                URANK.loadKeywordsSync();    
            } else {
                dataConn.getKeywords(URANK.loadKeywords);
            }
        }
        // LOAD TAGS (nothing happens if config.data_connector.urls.get_tags = null)
        dataConn.getTags(URANK.loadTags);
        // LOAD USERTAGS (nothing happens if config.data_connector.urls.get_usertags = null)
        if(config.features.usertags)
            dataConn.getUsertags(URANK.loadUserTags);
        // LOAD NEIGHBORS
        if(config.features.neighbors)
            dataConn.getNeighbors(URANK.loadNeighbors);
        // LOAD FACETS (year)
        config.facets.forEach(function(facet){
            dataConn.getFacets({ 'facet_type': facet.type }, URANK.loadFacets)
        })
        //  Custom callback
        callbacks.onLoad.call(this);
    };


    var destroy = function() {
        views.tagCloud.destroy();
        views.tagBox.destroy();
        views.contentList.destroy();
        views.visCanvas.destroy();
        views.docViewer.destroy();
    };

    var clear = function() {
        views.tagCloud.clear();
        views.tagBox.clear();
        views.docViewer.clear();
//            contentList.clear();
        //visCanvas.destroy();
    };

    var bookmarkItem = function(documentId){
        var index = _.findIndex(data, function(d){ return d.id == documentId })
        if (index > -1 ) {
            data[index].bookmarked = true;
            views.contentList.toggleFavicon(documentId, 'on');  
        }
    };

    var unbookmarkItem = function(documentId){
        var index = _.findIndex(data, function(d){ return d.id == documentId })
        if (index > -1 ) {
            data[index].bookmarked = false;
            views.contentList.toggleFavicon(documentId, 'off');  
        }
        
    };

    //  Miscelaneous
    var getCurrentState = function(){
        return {
            mode: rMode,
            status: rankingModel.getStatus(),
            selectedKeywords: _this.selectedKeywords.map(function(sk){ return { term: sk.term, weight: sk.weight } }),
            ranking: rankingModel.getRanking().map(function(d){
                return {
                    id: d[attr.id],
                    title: d[attr.title],
                    rankingPos: d.rankingPos,
                    overallScore: d.overallScore,
                    maxScore: d.maxScore,
                    positionsChanged: d.positionsChanged,
                    weightedKeywords: d.weightedKeywords.map(function(wk){ return { term: wk.term, weightedScore: wk.weightedScore } })
                }
            })
        };
    };

    var getSelectedFeatures = function(){ 
        return _this.selectedFeatures
    };

    ////////////////////////////////////////////////////////////////////////////////////////////////////
    //  Prototype
    ////////////////////////////////////////////////////////////////////////////////////////////////////
    Urank.prototype = {
        setUser: setUser,
        load: load,
        clear: clear,
        destroy: destroy,
        bookmarkItem: bookmarkItem,
        unbookmarkItem: unbookmarkItem,
        getCurrentState: getCurrentState,
        getSelectedFeatures: getSelectedFeatures
    };

    return Urank;
})();

module.exports = Urank;
