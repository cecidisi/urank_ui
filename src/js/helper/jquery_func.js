
(function($) {

    $.fn.extend({
        pin: function(args) {

            var options = $.extend({
                top: 0,
                left: 0,
                bottom: 0,                  // only if relativeTo != 'none'
                right: 0,                   // only if relativeTo != 'none'
                'vertical-aligned': false,
                container: 'window',
                relativeTo: 'parent'        // parent | none | custom selector
            }, args);

            return this.each(function() {
                var $this = $(this);
                if($this.css('visibility') == 'visible') {

                    var top, left;
                    if(options.relativeTo !== 'none') {
                        var $refElem = options.relativeTo == 'parent' ? $this.parent() : options.relativeTo;
                        // Left offset
                        left = options.left ? 
                            $refElem.fullOffset().left - $this.fullWidth() - options.left:
                            $refElem.fullOffset().left + $refElem.fullWidth() + options.right;
                        // Top offset
                        top = options.top ? 
                            $refElem.fullOffset().top + options.top :
                            $refElem.fullOffset().top + $refElem.fullHeight() + options.bottom;               
                        // Vertical alignment
                        if(options['vertical-aligned']) 
                            top -= $this.fullHeight() / 2;
                        // Pseudo element
                        if($this.hasClass('triangle-left')) {
                            var color = $this.css('borderColor') || $this.css('backgroundColor') // || $this.css('backgroundColor')
                            $('<div/>').appendTo($this).css({
                                'left': $this.fullWidth() - parseInt($this.css('border-right-width').replace('px', '')),
                                'top': $this.fullHeight()/2 - 22,
                                'width': 0,
                                'height': 0,
                                'position': 'absolute',
                                'border-left': '20px solid ' + color,
                                'border-top': '13px solid transparent',
                                'border-bottom': '13px solid transparent'
                            })
                        }
                                    
                    }

                    $this.css({ 'position': 'fixed', 'top': top, 'left': left, 'z-index': 9999 });

                    if(options.container !== 'window') {
                        var $container = $(options.container),
                            containerOffset = $container.offset(),
                            containerHeight = $container.height(),
                            //     containerWidth = $container.width(),
                            thisOffset = $this.fullOffset(),
                            thisHeight = $this.height();
                        //   thisWidth = $this.width();

                        if(thisOffset.top < containerOffset.top || (thisOffset.top + thisHeight) > (containerOffset.top + containerHeight)
                           /*|| thisOffset.left < containerOffset.left || (thisOffset.left + thisWidth) > containerOffset.left + containerWidth */)
                            $this.css('visibility', 'hidden');
                    }
                }
                return $this;
            });
        },
        
        fullHeight: function() {
            var m = {
                border: {
                    top: $(this).css('border-top-width') || '0px',
                    bottom: $(this).css('border-bottom-width') || '0px'
                },
                padding: {
                    top: $(this).css('padding-top') || '0px',
                    bottom: $(this).css('padding-bottom') || '0px'
                }
            };

            return $(this).height()
                + parseInt(m.border.top.replace('px', ''))
                + parseInt(m.padding.top.replace('px', ''))
                + parseInt(m.border.bottom.replace('px', ''))
                + parseInt(m.padding.bottom.replace('px', ''));
        },

        fullOffset: function() {
            return {
                top: $(this).offset().top + parseInt($(this).css('margin-top').replace('px', '')),
                    //  parseInt($(this).css('border-top-width').replace('px', '')) +
                    //parseInt($(this).css('padding-top').replace('px', '')) +
                left: $(this).offset().left + parseInt($(this).css('margin-left').replace('px', ''))
                    //parseInt($(this).css('border-left-width').replace('px', '')) +
                    //parseInt($(this).css('padding-left').replace('px', ''))
            };
        },

        fullWidth: function() {
            return $(this).width()
                + parseInt($(this).css('border-left-width').replace('px', ''))
                + parseInt($(this).css('padding-left').replace('px', ''))
                + parseInt($(this).css('border-right-width').replace('px', ''))
                + parseInt($(this).css('padding-right').replace('px', ''));
        },

        getText: function() {
            return $(this).clone().children().remove().end().text();
        },

        outerHTML: function() {
            return $(this).clone().wrap('<div></div>').parent().html();
        },

        scrollTo: function(target, options, callback){

            if(typeof options == 'function' && arguments.length == 2){
                callback = options;
                options = target;
            }

            var settings =
                $.extend({
                    scrollTarget  : target,
                    offsetTop     : 0,
                    duration      : 500,
                    easing        : 'swing'
                }, options);

            return this.each(function(){
                var scrollPane = $(this);

                var scrollTarget;
                if( typeof settings.scrollTarget == "number" ){
                    scrollTarget = settings.scrollTarget;
                }
                else{
                    if( settings.scrollTarget == "top" ){
                        scrollTarget = 0;
                    }
                    else{
                        scrollTarget = $(settings.scrollTarget);
                        settings.offsetTop += scrollPane.offset().top;
                    }
                }

                //var scrollTarget = (typeof settings.scrollTarget == "number") ? settings.scrollTarget : $(settings.scrollTarget);
                var scrollY = (typeof scrollTarget == "number") ? scrollTarget : scrollPane.scrollTop() + scrollTarget.offset().top - settings.offsetTop;

                scrollPane.animate({scrollTop : scrollY }, parseInt(settings.duration), settings.easing, function(){
                    if (typeof callback == 'function') { callback.call(this); }
                });
            });
        },

        // unfinished
        tooltip: function(options) {

            var tooltipClass = 'urank-tooltip';

            var $this = $(this);


            if(typeof options == 'string' && options == 'destroy'){


            } else if(typeof options == 'object') {
                var s = $.extend({
                    title: null,
                    message: '',
                    position: 'right',      //  right | left | top | bottom
                    type: 'default',        //  default | info |
                    root: 'body'
                }, options);

                $tooltip = $('<div/>', { class: tooltipClass }).appendTo($this);

            }

            return $this;
        }

    });
    
    
}(jQuery));
