
var KeywordExtractor = (function(){

    var _this,
        s = {},
        stemmer, tokenizer, nounInflector, tfidf, stopWords, pos, lexer, tagger,
        POS = {
            NN: 'NN',           // singular noun
            NNS: 'NNS',         // plural noun
            NNP: 'NNP',         // proper noun
            JJ: 'JJ'            // adjective
        };

    //  CONSTRUCTOR
    function KeywordExtractor(options) {
        s = $.extend(true, {
            minDocFrequency: 2,
            minRepetitionsInDocument: 1,
            maxKeywordDistance: 5,
            minRepetitionsProxKeywords: 4
        }, options);
        _this = this;
        this.collection = [];
        this.documentKeywords = [];
        this.collectionKeywords = [];
        this.collectionKeywordsDict = {};

        stemmer = natural.PorterStemmer; //natural.LancasterStemmer;
        stemmer.attach();
        tokenizer = new natural.WordTokenizer;
        nounInflector = new natural.NounInflector();
        nounInflector.attach();
        //tfidf = new natural.TfIdf(),
        stopWords = natural.stopwords;
        pos = new Pos();
        lexer = new pos.Lexer();
        tagger = new pos.Tagger();
    }


/************************************************************************************************************************************
*
*   PRIVATE METHODS
*
************************************************************************************************************************************/



    var extractDocumentKeywords = function(collection) {

        //POS tagging
        collection.forEach(function(d, i) {
            d.taggedWords = tagger.tag(lexer.lex(d.text));
        });

        // Find out which adjectives are potentially important and worth keeping
        var keyAdjectives = getKeyAdjectives(collection);

        // Create each item's document to be processed by tf*idf
        collection.forEach(function(d) {
            d.tokens = getFilteredTokens(d.taggedWords, keyAdjectives);                                       // d.tokens contains raw nouns and important adjectives
            tfidf.addDocument(d.tokens.map(function(term){ return term.stem(); }).join(' '));                 // argument = string of stemmed terms in document array
        });

        // Save keywords for each document
        var documentKeywords = [];
        collection.forEach(function(d, i){
            documentKeywords.push(getDocumentKeywords(i));
        });

        return documentKeywords;
    };



    var getKeyAdjectives = function(_collection) {

        var candidateAdjectives = [],
            keyAdjectives = [];

        _collection.forEach(function(d, i) {
            // Find out which adjectives are potentially important and worth keeping
            d.taggedWords.forEach(function(tw){
                if(tw[1] == 'JJ'){
                    var adjIndex = _.findIndex(candidateAdjectives, function(ca){ return ca.adj === tw[0].toLowerCase() });
                    if(adjIndex == -1)
                        candidateAdjectives.push({ 'adj': tw[0].toLowerCase(), 'count': 1 });
                    else
                        candidateAdjectives[adjIndex].count++;
                }
            });
        });

        candidateAdjectives.forEach(function(ca){
            if(ca.count >= parseInt(_collection.length * 0.25))
                keyAdjectives.push(ca.adj);
        });
        return keyAdjectives;
    }


    // Filter out meaningless words, keeping only nouns (plurals are singularized) and key adjectives
    var getFilteredTokens = function(taggedWords, keyAdjectives) {
        var filteredTerms = [];
        taggedWords.forEach(function(tw){
            switch(tw[1]){
                case POS.NN:          // singular noun
                    tw[0] = (tw[0].isAllUpperCase()) ? tw[0] : tw[0].toLowerCase();
                    filteredTerms.push(tw[0]); break;
                case POS.NNS:         // plural noun
                    filteredTerms.push(tw[0].toLowerCase().singularizeNoun());
                    break;
                case POS.NNP:         // proper noun
                    tw[0] = (tagger.wordInLexicon(tw[0].toLowerCase())) ? tw[0].toLowerCase().singularizeNoun() : tw[0];
                    filteredTerms.push(tw[0]); break;
                case POS.JJ:
                    if(keyAdjectives.indexOf(tw[0]) > -1)
                        filteredTerms.push(tw[0]); break;
            }
        });
        return filteredTerms;
    }


    var getDocumentKeywords = function(dIndex) {
        var docKeywords = {};
        // console.log('index = ' + dIndex);
        tfidf.listTerms(dIndex).forEach(function(item){
            if( item.term.toUpperCase().includes('ERROR')) {
                console.log('term =' + item.term);
            }
            if(isNaN(item.term) && parseFloat(item.tfidf) > 0 ) {
                docKeywords[item.term] = item.tfidf;
            }
        });

        // var words = Object.keys(docKeywords).map(function(key){ return key; });
        // console.log(words.join(' -- '));
        return docKeywords;
    }




    /////////////////////////////////////////////////////////////////////////////

    var extractCollectionKeywords = function(collection, documentKeywords, minDocFrequency) {

        minDocFrequency = minDocFrequency ? minDocFrequency : s.minDocFrequency;
        var keywordDict = getKeywordDictionary(collection, documentKeywords, minDocFrequency);

        // get keyword variations (actual terms that match the same stem)
        collection.forEach(function(d){
            d.tokens.forEach(function(token){
                var stem = token.stem();
                if(keywordDict[stem] && stopWords.indexOf(token.toLowerCase()) == -1)
                    keywordDict[stem].variations[token] =
                        keywordDict[stem].variations[token] ? keywordDict[stem].variations[token] + 1 : 1;
            });
        });

        // compute keywords in proximity
        keywordDict = computeKeywordsInProximity(collection, keywordDict);
        var collectionKeywords = [];

        var cleanKeywordDict = {};
        _.keys(keywordDict).forEach(function(kw, i) {
            kw.num_keyphrases = Object.keys(kw.keywordsInProximity).length;
            // get human-readable term for each stem key in the dictionary
            var kw_term = getRepresentativeTerm(keywordDict[kw]);

            if(kw_term !== 'ERROR') {
                // Copy to clean dict only if rep. term isn't ERROR and assign the term to entry in clean dict
                cleanKeywordDict[kw] = keywordDict[kw];
                cleanKeywordDict[kw].term = kw_term;

                // Put keywords in proximity in sorted array
                var proxKeywords = [];
                _.keys(cleanKeywordDict[kw].keywordsInProximity).forEach(function(proxKeyword){
                    var proxKeywordsRepetitions = cleanKeywordDict[kw].keywordsInProximity[proxKeyword];
                    if(proxKeywordsRepetitions >= s.minRepetitionsProxKeywords)
                        proxKeywords.push({ stem: proxKeyword, count: proxKeywordsRepetitions });
                });
                cleanKeywordDict[kw].keywordsInProximity = proxKeywords.sort(function(proxK1, proxK2){
                    if(proxK1.count < proxK2.count) return 1;
                    if(proxK1.count > proxK2.count) return -1;
                    return 0;
                });

                // store each key-value in an array
                collectionKeywords.push(cleanKeywordDict[kw]);
            }
        });
        keywordDict = $.extend(true, {}, cleanKeywordDict);

        // sort keywords in array by document frequency
        collectionKeywords = collectionKeywords.sort(function(k1, k2){
                if(k1.df < k2.df) return 1;
                if(k1.df > k2.df) return -1;
                return 0;
            });
        collectionKeywords.forEach(function(k, i){
            keywordDict[k.stem].index = i;
        });

        return { array: collectionKeywords, dict: keywordDict };
    };



    var getKeywordDictionary = function(_collection, _documentKeywords, _minDocFrequency) {

        var keywordDict = {};
        _documentKeywords.forEach(function(docKeywords, i){

            _.keys(docKeywords).forEach(function(stemmedTerm){
                if(!keywordDict[stemmedTerm]) {
                    keywordDict[stemmedTerm] = {
                        stem: stemmedTerm,
                        term: '',
                        df: 1,
                        num_keyphrases: 0,
                        variations: {},
                        inDocument : [_collection[i].id],
                        keywordsInProximity: {}
                    };
                }
                else {
                    keywordDict[stemmedTerm].df++;
                    keywordDict[stemmedTerm].inDocument.push(_collection[i].id);
                }
            });
        });

        _.keys(keywordDict).forEach(function(keyword){
            if(keywordDict[keyword].df < _minDocFrequency)
                delete keywordDict[keyword];
        });
        return keywordDict;
    };


    var computeKeywordsInProximity = function(_collection, _keywordDict) {
        _collection.forEach(function(d){
            d.tokens.forEach(function(token, i, tokens){

                var current = token.stem();
                if(_keywordDict[current]) {   // current word is keyword

                    for(var j=i-s.maxKeywordDistance; j <= i+s.maxKeywordDistance; j++){
                        var prox = tokens[j] ? tokens[j].stem() : undefined;

                        if(_keywordDict[prox] && current != prox) {
                            //var proxStem = prox.stem();
                            _keywordDict[current].keywordsInProximity[prox] = _keywordDict[current].keywordsInProximity[prox] ? _keywordDict[current].keywordsInProximity[prox] + 1 : 1;
                        }
                    }
                }
            });
        });
        return _keywordDict;
    };


    var getRepresentativeTerm = function(k){

        var keys = _.keys(k.variations);

        if(keys.length == 0)
            return 'ERROR';

        // Only one variations
        if(keys.length == 1)
            return keys[0];

        // 2 variations, one in lower case and the other starting in uppercase --> return in lower case
        if(keys.length == 2 && !keys[0].isAllUpperCase() && !keys[1].isAllUpperCase() && keys[0].toLowerCase() === keys[1].toLowerCase())
            return keys[0].toLowerCase();

        // One variation is repeated >= 75%
        var repetitions = 0;
        for(var i = 0; i < keys.length; ++i)
            repetitions += k.variations[keys[i]];

        for(var i = 0; i < keys.length; ++i)
            if(k.variations[keys[i]] >= parseInt(repetitions * 0.75))
                return keys[i];

        // One variation end in 'ion', 'ment', 'ism' or 'ty'
        for(var i = 0; i < keys.length; ++i)
            if(keys[i].match(/ion$/) || keys[i].match(/ment$/) || keys[i].match(/ism$/) || keys[i].match(/ty$/))
                return keys[i].toLowerCase();

        // One variation matches keyword stem
        if(k.variations[k.stem])
            return k.stem;

        // Pick shortest variation
        var shortestTerm = keys[0];
        for(var i = 1; i < keys.length; i++){
            if(keys[i].length < shortestTerm.length)
                shortestTerm = keys[i];
        }
        return shortestTerm.toLowerCase();
    };



/********************************************************************************************************************************************
*
*   PROTOTYPE
*
*********************************************************************************************************************************************/

    KeywordExtractor.prototype = {
        addDocument: function(document, id) {
            document = (!Array.isArray(document)) ? document : document.join(' ');
            id = id || this.collection.length;
            this.collection.push({ id: id, text: document });
        },
        processCollection: function() {
            tfidf = new natural.TfIdf();
            var timestamp = $.now();
            this.documentKeywords = extractDocumentKeywords(this.collection);
            var collectionKeywords = extractCollectionKeywords(this.collection, this.documentKeywords);
            this.collectionKeywords = collectionKeywords.array;
            this.collectionKeywordsDict = collectionKeywords.dict;

            var miliseconds = $.now() - timestamp;
            var seconds = parseInt(miliseconds / 1000);
            console.log('Keyword extraction finished in ' + seconds + ' seconds, ' + miliseconds%1000 + ' miliseconds (=' + miliseconds + ' ms)');
        },
        listDocumentKeywords: function(index) {
            return this.documentKeywords[index];
        },
        getCollectionKeywords: function() {
            return this.collectionKeywords;
        },
        getCollectionKeywordsDictionary: function() {
            return this.collectionKeywordsDict;
        },
        clear: function() {
            tfidf = null;
            this.collection = [];
            this.documentKeywords = [];
            this.collectionKeywords = [];
            this.collectionKeywordsDict = {};
        }
    };

    return KeywordExtractor;
})();


module.exports = KeywordExtractor;











