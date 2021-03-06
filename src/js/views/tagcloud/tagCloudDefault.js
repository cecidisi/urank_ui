
require('../../helper/jquery_func');

var TagCloudDefault = (function(){

    var _this;
    // Settings
    var s = {};
    //  Classes
    var tagcloudDefaultClass = 'urank-tagcloud-default',
        hiddenScrollbarClass = 'urank-hidden-scrollbar',
        hiddenScrollbarInnerClass = 'urank-hidden-scrollbar-inner',
        visibleScrollbarClass = 'urank-visible-scrollbar',
        tagContainerClass = 'urank-tagcloud-tag-container',
        tagClass = 'urank-tagcloud-tag',
        activeClass = 'active',
        hoveredClass = 'hovered',
        selectedClass = 'selected',
        disabledClass = 'disabled',
        droppedClass = 'dropped',
        focusedClass = 'focused',
        hiddenClass = 'hidden',
        addableClass = 'addable',
        addedClass = 'added',
        tagHintClass = 'urank-tagcloud-tag-hint',
        keywordHintClass = 'urank-tagcloud-tag-cooccurence-hint',
        documentHintClass = 'urank-tagcloud-tag-document-hint',
        tooltipClass = 'urank-tagcloud-tag-tooltip',
        addIconClass = 'urank-tagcloud-tag-add-icon';
    //  Ids
    var tagIdPrefix = '#urank-tag-',
        tagPiePrefix = '#urank-tag-pie-';
    //   Attributes
    var tagPosAttr = 'tag-pos';
    //  Helpers
    var backgroudGradient = "top, rgb(0, 102, 255), rgb(20, 122, 255), rgb(0, 102, 255)";
    var $root = $(''), $scrollable = $(''), $tagContainer = $(''), $tooltip = $(''), $keyphraseDialog = $(''),
        tooltipTimeOut, fadeOutTimeOut, kpDialogTimeOut;

    var tagHintPinOptions = {
            document: { top: -6, right: -10, container: '.'+tagcloudDefaultClass },
            cooccurence: { bottom: -10, right: -10, container: '.'+tagcloudDefaultClass }
        };

    var pieOptions = {
            size: { pieOuterRadius: '100%', canvasHeight: '14', canvasWidth: '14' },
            effects: {
                load: { effect: "none" },
                pullOutSegmentOnClick: { effect: 'none', speed: 0, size: 0 },
                highlightSegmentOnMouseover: false
            },
            labels: {
                inner: { format: '' },
                lines: { enabled: false}
            },
            data: {
                content: [
                    { label: 'documentsIn', value: 0, color: '#65BA20' },
                    { label: 'documentsNotIn', value: 0, color: '#fafafa' },
                ]
            },
            misc: {
                colors: { segmentStroke: '#65a620' },
                canvasPadding: { top: 0, right: 0, bottom: 0, left: 0 },
                gradient: { enabled: true, percentage: 100, color: "#888" },
            }
        };

    //  Constructor
    function TagCloudDefault(params) {
        _this = this;
        s = $.extend({
            root: '',
            attr: {},
            options: {}, // numCategories, tagStyle
            cb:{
                onTagInCloudMouseEnter: function(index, id){},
                onTagInCloudMouseLeave: function(index, id){},
                onTagInCloudClick: function(index, id){},
                onTagSelected: function(index, id){},    // used when selction == 'click'
                onKeyphraseSelected: function(phrases){}
            }
        }, params);

        this.keywords = [];
        this.isTagBeingDragged = false;
        this.tagHintMode = false;
        this.selectedTag = undefined;
        this.addedTags = [];
    }

    // jquery function to change tag style
    $.fn.setTagStyle = function() {
        var $tag = $(this);
        var idx = parseInt($tag.attr('tag-pos'));
        // var kw = _this.keywords[idx];

        if($tag.hasClass('disabled'))
            return $tag.css({ background: '', border: '' });

        if($tag.hasClass('active') && ($tag.hasClass('hovered') || $tag.hasClass('selected') || $tag.hasClass('added')))
            return $tag.css({ background: '', border: '' });

        // dropped class is always for a cloned tag
        if($tag.hasClass('dropped')) {
            var color = $tag.data('tagColor');
            var border = 'solid 1px ' + color;
            var bg = s.options.highlight === 'background' ? color : 'transparent';
            var fontColor = s.options.highlight === 'background' ? 'white' : color; // kw.color;
            return $tag.css({ 'background': bg, 'border': border, 'color': fontColor });
        }
            
        if($tag.hasClass('active')/* || $tag.hasClass('addable')*/) {
            if(s.options.tagStyle === 'badge') {
                return $tag.addClass('badge').css({
                    background: function() { return getGradientString($tag.data('originalColor')) },
                    border: '',
                });
            } else if(s.options.tagStyle === 'word') {
                // console.log(s.options.minFontSize + s.options.fontSizeGrowth * kw.score);
                var tagScore = parseInt($tag.data('score'));
                return $tag.addClass('word').css({
                    'color': $tag.data('originalColor'),
                    'font-size': (s.options.minFontSize + s.options.fontSizeGrowth * tagScore) + 'px',
                    'border': '', 'background': ''
                });
            }
        }
            
        return $tag;
    };

    /// Tag Cloud root and container event handlers
    var onRootScrolled = function(event) {
        event.stopPropagation();
        if(_this.tagHintMode)
            pinTagHints($('.'+tagClass+'.'+selectedClass));
    };

    ////////////////////////////////////////////////
    // DRAGGABLE EVENTS AND OPTIONS
    ////////////////////////////////////////////////

    var $draggedTag = undefined;
    var originalOffset = {};

    var draggableEvt = {
        // ON DRAG STARTED
        onTagDragStarted : function(event, ui){
            _this.isTagBeingDragged = true;
            $tooltip.hide();
            clearTimeout(tooltipTimeOut);
            clearTimeout(fadeOutTimeOut);

            $(this).data('dropped', false).data('addedTags', _this.addedTags)
            //.removeClass(hoveredClass)
            //.setTagStyle()
            ;

            $(ui.helper).addClass('dragging');

            $draggedTag = $(this).clone()
                .attr('id', $(this).attr('id') + '-clon')
                .data('originalColor', $(this).data('originalColor'))
                .removeClass('ui-draggable').removeClass('ui-draggable-handle')
                .setTagStyle()
                .hide();
            $(this).after($draggedTag);

            // Start added tag animation
            originalOffset = { top: event.pageY, left: event.pageX };

            $('.'+addedClass).each(function(i, addedTag){
                var $addedTag = $(addedTag);
                var $clonAddedTag = $addedTag.clone()
                    .attr('id', $(this).attr('id') + '-clon')
                    .data('originalColor', $(this).data('originalColor'))
                    .removeClass('ui-draggable').removeClass('ui-draggable-handle')
                    .setTagStyle();

                var tagOffset = $addedTag.position();
                $addedTag.after($clonAddedTag);
                $addedTag.detach()
                .appendTo('body')
                .css({
                    position: 'absolute',
                    left: tagOffset.left,
                    top: tagOffset.top,
                    'z-index': 9999
                });
            });
        },

        // ON DRAGGED
        onTagDragged : function(event, ui){
            var currentOffset = { top: event.pageY - originalOffset.top, left: event.pageX - originalOffset.left };
            originalOffset = { top: event.pageY, left: event.pageX };

            _this.addedTags.forEach(function(tag, i){
                var $addedTag = $(tagIdPrefix + '' + tag.id);
                var tagOffset = $addedTag.position();
                $addedTag.css({ left: tagOffset.left + currentOffset.left, top: tagOffset.top + currentOffset.top });
            });

        },

        // DRAG STOPPED
        onTagDragStopped : function(event, ui){
            _this.isTagBeingDragged = false;
            var $tag = $(this).data('addedTags', '');

            if($tag.data('dropped')) {
                $tag.draggable("destroy");
                $draggedTag.show().removeClass(hoveredClass);
            }
            else {
                $tag.removeClass(hoveredClass).removeClass(disabledClass).setTagStyle();
                $draggedTag.remove();
            }

            //  Added tags
            _this.addedTags.forEach(function(addedTag){
                var $addedTag = $(tagIdPrefix + '' + addedTag.id);
                var $clonAddedTag = $(tagIdPrefix + '' + addedTag.id + '-clon');
                // Restore added tag position
                $addedTag = $addedTag.css({ position: '', left: '', top: '', 'z-index': '' });

                // If dragged tag isn't drop, re-attach added tags and remove clones
                if(!$tag.data('dropped')) {
                    $addedTag = $addedTag.detach();
                    $clonAddedTag.after($addedTag);
                    $clonAddedTag.remove();
                }
            });
            originalOffset = {};
        }

    };


    var draggableOptions = {
        revert: 'invalid',
        helper: 'clone',
        appendTo: '.urank-tagbox-container',
        zIndex: 999,
        start: draggableEvt.onTagDragStarted,
        drag: draggableEvt.onTagDragged,
        stop: draggableEvt.onTagDragStopped
    };

    ////////////////////////////////////////////////
    // End DRAGGABLE EVENTS AND OPTIONS
    ////////////////////////////////////////////////



    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //  Internal functions

    var extendKeywordsWithColorCategory = function(keywords, numCategories){

        var extent = d3.extent(keywords, function(k){ return k.df; });
        var range = (extent[1] - 1) * 0.1;   // / TAG_CATEGORIES;

        keywords.forEach(function(k){
            var colorCategory = parseInt((k.df - 1/*extent[0]*/) / range);
            k['colorCategory'] = (colorCategory < numCategories) ? colorCategory : numCategories - 1;
        });
        return keywords;
    };


    var pinTagHints = function($tag) {
        $tag.find('.'+documentHintClass).css('visibility', 'visible').pin(tagHintPinOptions.document);
        $tag.find('.urank-doc-hint').pin(tagHintPinOptions.document);
    };


    var setTagProperties = function($tag) {
        var index = $tag.attr(tagPosAttr);
        var id = $tag.attr('tag-id');
        $tag.off().on({
            mousedown : function(evt){ if(evt.which == 1) evt.stopPropagation(); },
            mouseenter: function(evt){ s.cb.onTagInCloudMouseEnter(index, id) },
            mouseleave: function(evt){ evt.stopPropagation(); s.cb.onTagInCloudMouseLeave(index, id); },
            click: function(evt){ _tagClicked(index, id) }
        });
    
        // if it's not clon of dropped tag, add class active and make it drggable
        if(!$tag.hasClass(droppedClass)) {
            // Set default style
            $tag.addClass(activeClass);
            // Set draggable if selection = 'drag'
            if(s.options.selection === 'drag') {
                if($tag.is('.ui-draggable'))
                    $tag.draggable('destroy');
                $tag.draggable(draggableOptions);    
            }
        } 
        // if ($tag.hasClass(hiddenClass))
        //     $tag.hide();    
    
        // Reset hints visibility
        $tag.find('.'+documentHintClass).css('visibility', '')
    
        return $tag.setTagStyle();
    };



    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //  Prototype methods

    /**
    * * @param {array of objects} keywords Description
    */
    var _build = function(keywords, data, colorScale){
        this.keywords = extendKeywordsWithColorCategory(keywords.slice(), s.options.numCategories);
        this.data = data;
        this.colorScale = colorScale;

        // Empty tag container and add appropriate class/es
        $root = $(s.root).empty().addClass(tagcloudDefaultClass);
        // Append tooltip
        $tooltip = $('<div/>').appendTo($root).addClass(tooltipClass).width($root.width() - 10);
        // $("<p><strong name='num-docs'></strong> items contain</p>").appendTo($tooltip);
        // // $("<p><strong name='num-docs'></strong> (<strong name='pctg-docs'></strong>) documents contain</p>").appendTo($tooltip);
        // $("<p><strong name='tag'></strong></p>").appendTo($tooltip);
        // // $("<p>Appears in <strong name='num-kw'></strong> phrases</p>").appendTo($tooltip);
        // // $("<p><strong name='num-kw'></strong> other keywords in proximity</p>").appendTo($tooltip);

        $("<p><strong name='tag'></strong></p>").appendTo($tooltip);
        $("<p>appears in <strong name='num-docs'></strong> items</p>").appendTo($tooltip);

        $tooltip.css('top', $root.position().top - $tooltip.fullHeight()).hide();

        // Set scrollable
        var scrollableClass = visibleScrollbarClass;
        if(s.options.aes.hideScrollbar) {
            $('<div/>').appendTo($root).addClass(hiddenScrollbarClass);
            scrollableClass = hiddenScrollbarClass;
        }
        $scrollable = $('<div/>').appendTo($root)
            .addClass(scrollableClass)
            .on('scroll', onRootScrolled);
        $tagContainer = $('<div/>').appendTo($scrollable)
            .addClass(tagContainerClass).on({
                'mouseleave': function(evt){ 
                    evt.stopPropagation() 
                    $('.urank-keyphrase-dialog').remove();
                }
            });
        

        this.keywords.forEach(function(k, i){
            // Append tag
            k.color = _this.colorScale(k.colorCategory);
            var $tag = $('<div/>', { 
                'id': 'urank-tag-' + k.id, 
                'tag-id': k.id || i,
                'tag-pos': i,
                'name': k.term 
            }).appendTo($tagContainer)
                .addClass(tagClass + ' ' + activeClass/* + ' hint--info hint--left'*/)
                .data({ 
                    'originalColor': _this.colorScale(k.colorCategory),
                    'score': k.score
                })
                .html(k.term)
                // .hide()
                // .fadeIn((i+1)*20);
            // Pie chart section for document hint
            // var docPctg = parseInt((k.df * 100) / _this.data.length);
            // if(docPctg > 0 && docPctg < 5) { docPctg = 5; }
            // else {
            //     if(docPctg%5 < 3) docPctg = docPctg - docPctg%5;
            //     else docPctg = docPctg + 5 - docPctg%5;
            // }
            // var $docHint = $('<a/>', { class: 'urank-doc-hint urank-doc-hint-'+docPctg, href: '#' }).appendTo($tag);
//            var $docHint = $('<div/>', { class: tagHintClass+' '+documentHintClass, id: 'urank-tag-pie-' + i }).appendTo($tag);
//            pieOptions.data.content[0].value = k.df;
//            pieOptions.data.content[1].value = _this.data.length - k.df || 0.1;
//            var tagPie = new d3pie(tagPiePrefix+''+i, pieOptions);
            // Red circle for keywords in proximity hint
            if(k.num_keyphrases)                
                $('<a/>', { class: keywordHintClass, 'data-content': k.df, href: '#' }).appendTo($tag);
            // Add/remove icon
            $('<a/>', { href: '#' }).appendTo($tag).addClass(addIconClass);
            setTagProperties($tag);
        });
        return this;
    };


    var _addTag = function(k, i, prepend, animate) {
        prepend = prepend || false;
        animate = animate || false;
        k.colorCategory = 1;
        k.color = _this.colorScale(k.colorCategory);
        var $tag = $('<div/>', { 
            'id': 'urank-tag-' + k.id, 
            'class': tagClass + ' ' + activeClass,
            'tag-id': k.id || i,
            'tag-pos': i,
            'name': k.term,
            'html': k.term
        }).data({ 
            'originalColor': k.color,
            'score': k.score
        });
        // Red circle for keywords in proximity hint
        if(k.num_keyphrases)                
            $('<a/>', { class: keywordHintClass, 'data-content': k.df, href: '#' }).appendTo($tag);
        // Add/remove icon
        $('<a/>', { href: '#' }).appendTo($tag).addClass(addIconClass);
        // Append / prepend to container
        if(prepend) {
            $tag.prependTo($tagContainer)
        } else {
            $tag.appendTo($tagContainer)    
        }
        setTagProperties($tag);
        if(animate) {
            $tag.css({ color: 'crimson'})
                .animate({ color: k.color }, 1500, 'swing')
        }

    };


    var _reset = function() {
        return this.build(this.keywords, this.data, this.colorScale, s.options);
    };


    var _hoverTag = function(tag, index) {
        var $tag = $(tagIdPrefix + '' + tag.id);
        if(!_this.tagHintMode && !_this.isTagBeingDragged) {
            if(!$tag.hasClass(droppedClass))
                $tag.addClass(hoveredClass).setTagStyle();
                    //.css(tagStyle.hover);
            pinTagHints($tag);
            tooltipTimeOut = setTimeout(function(){
                $tooltip.find("[name='num-docs']").html(tag.df);
                $tooltip.find("[name='pctg-docs']").html(Math.floor(tag.df/_this.data.length * 100) + '%');
                $tooltip.find("[name='tag']").html(tag.term.toUpperCase());
                $tooltip.find("[name='num-kw']").html(tag.num_keyphrases);
                $tooltip.fadeIn();
                fadeOutTimeOut = setTimeout(function(){
                    $tooltip.fadeOut();
                }, 4000);
            }, 500);
        }
    };


    var _unhoverTag = function(tag, index) {
        var $tag = $(tagIdPrefix + '' + tag.id);

        if(!_this.tagHintMode && !_this.isTagBeingDragged) {
            $tag.find('.'+documentHintClass).css('visibility', '');
            //if(!$tag.hasClass(droppedClass)) {
                $tag.removeClass(hoveredClass).setTagStyle();
            //}
            clearTimeout(tooltipTimeOut);
            clearTimeout(fadeOutTimeOut);
            $tooltip.hide();
        }
    };


    var _tagClicked = function(index, id) {
        var $tag = $(tagIdPrefix + '' + id);

        if (s.options.selection === 'click' && !$tag.hasClass(droppedClass)) {
            $clonTag = $tag.clone().attr('id', $tag.attr('id') + '-clon')
                //.addClass('dropped');//.setTagStyle(); //change color for background
                //css({ 'color': 'white', 'background-color': $tag.data('originalColor')});
            $tag.after($clonTag).addClass('dropped');
            s.cb.onTagSelected(index, id); // will append tag to tagbox and restyle clon here
            return;
        }

        if(s.options.selection === 'drag' && !_this.isTagBeingDragged) {
            // Add or remove tag from this.addedTags for multiple selection
            if(_this.selectedTag) {
                if($tag.hasClass(addableClass)) {
                    // _this.addedTags.push($tag.attr(tagPosAttr));
                    _this.addedTags.push({ 'index': index, 'id': id });
                    $tag.addClass(addedClass).removeClass(addableClass).setTagStyle();
                }
                else if($tag.hasClass(addedClass)) {
                    // _this.addedTags.splice(_this.addedTags.indexOf($tag.attr(tagPosAttr)), 1);
                    indexToExclude = _.findIndex(_this.addedTags, function(tag) {
                        return tag.id == id;
                    })
                    _this.addedTags.splice(indexToExclude, 1);
                    $tag.addClass(addableClass).removeClass(addedClass).setTagStyle();                    
                }
            }
            // 
            else {
                s.cb.onTagInCloudClick(index, id);  // so that urank shows/hides items in the list and ranking
                _this.selectedTag = index;
                $tag.addClass(selectedClass).removeClass(hiddenClass).setTagStyle();

                if(!$tag.hasClass(droppedClass)) {
                    if($tag.is('.ui-draggable'))
                        $tag.draggable('destroy');
                    $tag.draggable(draggableOptions);
                }

                // SIBLINGS
                var proxKeywords = _this.keywords[index].keywordsInProximity || {};
                $tag.siblings().each(function(i, sibling){

                    var $siblingTag = $(sibling);
                    if($siblingTag.is('.ui-draggable'))
                        $siblingTag.draggable('destroy');

                    $siblingTag.find('.'+documentHintClass).off().css('visibility', 'hidden');

                    // sibling tags that are not KW in proximity of current tag are dimmend and active class removed so they can't be dragged
                    if(_.findIndex(proxKeywords, function(proxKw){ return proxKw.id == $siblingTag.attr('tag-id') }) === -1) {
                        $siblingTag.addClass(disabledClass).removeClass(activeClass).setTagStyle();
                    }
                    else {                                      // Active tags are the ones co-occuring with the selected tag. A tooltip is added during proxKeywordsmode
                        if(!$siblingTag.hasClass(droppedClass)) {
                            $siblingTag.addClass(activeClass).addClass(addableClass);
                            $siblingTag.show();
                        }
                    }
                    pinTagHints($tag);
                });
                _this.tagHintMode = true;
            }
        } 
    };


    /**
	 *	Detach tag from tag box and return it to container (tag cloud)
	 *
	 * */
    var _restoreTag = function(tag, index) {

        if(!tag.is_new) {
            var $tag = $(tagIdPrefix + '' + tag.id);                    // is in tagcloud
            var $clonedTag = $(tagIdPrefix + '' + tag.id + '-clon');    // is in tagbox, will be deleted sync
            var $dummyTag = $clonedTag.clone();                     // need dummy for animation, clone is removed
            $dummyTag.attr('id', 'dummy-tag-' + tag.id);
            console.log('Animating ' + $dummyTag.attr('id'));
            //  Save offset in tagBox before detaching
            var oldOffset = $clonedTag.offset();
            var newOffset = $tag.offset();
            // Detach tag from tag cloud, attach temporarily to body and place it in old position (in tagBox)
            $dummyTag.appendTo('body')
                .css({ position: 'absolute', top: oldOffset.top, left: oldOffset.left, 'z-index': 9999 });
            // Animate tag moving from tag box to tag cloud
            $dummyTag.animate({ top: newOffset.top, left: newOffset.left }, 800, 'swing', function() {
                //  Detach from body after motion animation is complete and append to tag container again
                $dummyTag.remove();
                $tag.removeClass().addClass(tagClass + ' ' + activeClass); //.setTagStyle();
                setTagProperties($tag);
            });    
        }
        
    };


    var _focusTag = function(keyword/*, newOffset*/) {
        var $tag = $('#urank-tag-' + keyword.id);
        $tag.addClass(focusedClass).removeClass(hiddenClass); //.show();
        setTimeout(function(){
            $tag.removeClass(focusedClass, 2000);
        }, 2000);
        $scrollable.scrollTo('#urank-tag-' + keyword.id, { offsetTop: 10 });
        return this;
    };


    var _updateClonOfDroppedTag = function(index, id, tagColor) {
        var $tag = $(tagIdPrefix + '' + id)
            .data('tagColor', tagColor)
            .removeClass(activeClass).removeClass(disabledClass).removeClass(selectedClass)
            .addClass(droppedClass);
        $tag.setTagStyle();
        // setTagProperties($tag);
        return this;
    };



    var _showTagsWithinRange = function(min, max) {
        _this.keywords.forEach(function(k, i){
            // class selector before id selector avoids hiding tags in tagbox. cloned tags remain visible
            var $tag = $('.'+tagClass + '' + tagIdPrefix + '' + i);

            if(k.df >= min && k.df <= max)
                $tag.removeClass(hiddenClass); //.show();
            else
                $tag.addClass(hiddenClass); //.hide();
        });
    };


    var _showKeyphrases = function(index, id, keyphrases) {
        console.log('Got ' + keyphrases.length + ' keyphrases');
        console.log(keyphrases[0]);
        var $tag = $(tagIdPrefix + '' + id);

        $('.urank-keyphrase-dialog').remove();
        $keyphraseDialog = $('<div/>', { 
            id: 'keyphrase-tooltip', 
            class: 'urank-keyphrase-dialog triangle-left' 
        }).appendTo($root).on({
            mouseenter: function(evt){ evt.stopPropagation() },
            mousedown: function(evt){ 
                evt.stopPropagation() 
            }
        });
        // Tooltip title
        var $titleWrapper = $('<div/>', { class: 'title-wrapper' }).appendTo($keyphraseDialog);
        $('<div/>', { class: 'title', html: 'Phrases with '+ $tag.attr('name') }).appendTo($titleWrapper);
        keyphrases.slice(0, 10).forEach(function(p){
            var $feat = $('<div/>', { class: 'urank-keyphrase' }).appendTo($keyphraseDialog);
                var fontSize = Math.min(8 + p.count, 12);
                $('<span/>', { 
                    name: p.phrase.replace(' ', '_'), 
                    html: p.phrase 
                }).appendTo($feat)
                .css('font-size', fontSize+'px')
                .on({ 
                    click: function(evt){
                        evt.stopPropagation();
                        console.log('keyphrase clicked')
                        s.cb.onKeyphraseSelected(p);
                    },
                    mouseleave: function(evt){ evt.stopPropagation() }
                }) 
        })

        $keyphraseDialog.pin({ 
            'relativeTo': $tag,
            'vertical-aligned': true,
            // 'top': 0,
            'left':  20
        })

    };


    var _clearEffects = function() {

        _this.selectedTag = undefined;
        _this.addedTags = [];
        $('.urank-keyphrase-dialog').remove();
        if(_this.tagHintMode) {
            $('.'+tagClass).each(function(i, tag){
                var $tag = $(tag);
                $tag.removeClass(disabledClass).removeClass(selectedClass).removeClass(hoveredClass).removeClass(addedClass).removeClass(addableClass)
                setTagProperties($tag);
            });
            _this.tagHintMode = false;
        }
        return this;
    };



    var _clear = function() {
        $root.empty();
        return this;
    };


    var _destroy = function() {
        $root.empty();
        return this;
    };


    TagCloudDefault.prototype = {
        build: _build,
        addTag: _addTag,
        reset: _reset,
        restoreTag: _restoreTag,
        hoverTag: _hoverTag,
        tagClicked:_tagClicked,
        unhoverTag: _unhoverTag,
        focusTag: _focusTag,
        updateClonOfDroppedTag: _updateClonOfDroppedTag,
        showTagsWithinRange: _showTagsWithinRange,
        showKeyphrases: _showKeyphrases,
        clearEffects: _clearEffects,
        clear: _clear,
        destroy: _destroy
    };

    return TagCloudDefault;
})();

module.exports = TagCloudDefault;
