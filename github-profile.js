(function (factory) {

        factory(jQuery, radic);

}(function ($, R) {

    R.template.registerHelper('arrayIndex', function (context, ndx) {
        return context[ndx];
    });

    $.widget('radic.githubProfile', $.radic.base, {
        version: '0.0.1',

        options: {
            username: null,

            showProfile: true,
            showFollow: true,
            showLanguages: true,
            showRepositories: true,

            template: 'widget.github.profile',
            className: 'gh-profile-widget',

            spinner: true,
            spinnerOptions: {},

            sortBy: 'stars', // possible: 'stars', 'updateTime'
            repositoriesHeaderText: 'Most starred repositories',
            repositoriesDateFormat: 'lll',
            repositoriesLimit: 5,

            languagesHeaderText: 'Top languages',
            languagesLimit: 7
        },

        _spin: function(disable){
            if(this.options.spinner === true){
                if(typeof disable === 'boolean' && disable === false){
                    return this.element.spin(false);
                }
                this.element.spin(this.options.spinnerOptions);
            }
        },

        refresh: function(){
            var self = this;
            self._spin();

            self._getData(function (data) {
                self._spin(false);
                var $template = self._compile(self.options.template, data);
                self.element.html($template);
                self._trigger('completed', null);
            });
        },

        _create: function () {
            if(this.options.username === null || ! _.isString(this.options.username)){
                console.error('githubProfile widget has been initialized without the required username option');
                return;
            }
            this.refresh();
        },

        _sortLanguages: function (languages) {
            this._trigger('beforeSortLanguages', null, languages);
            var topLangs = [];
            for (var k in languages) {
                topLangs.push([k, languages[k]]);
            }

            topLangs.sort(function (a, b) {
                return b[1] - a[1];
            });
            this._trigger('afterSortLanguages', null, topLangs);
            return topLangs.slice(0, this.options.languagesLimit);
        },

        _sortRepositories: function (reposData) {
            this._trigger('beforeSortRepositories', null, reposData);
            var self = this;
            reposData.sort(function (a, b) {
                // sorted by last commit
                if (self.options.sortBy == 'stars') {
                    return b.stargazers_count - a.stargazers_count;
                } else {
                    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
                }
            });
            this._trigger('afterSortRepositories', null, reposData);
            return reposData.slice(0, self.options.repositoriesLimit);
        },

        _getData: function (callback) {
            var self = this;
            var username = this.options.username;
            radic.async.waterfall([
                function (done) {
                    //sradic.github.setTransport('')
                    var u = radic.github.users(username, function (userData, second) {
                        self._trigger('onReceivedUser', null, userData);
                        console.info('even more data', userData, radic.defined(second) ? second : 'no second');

                        done(null, userData);
                    });
                    console.log('u2', u);
                },
                function (userData, done) {

                    radic.github.users.repos(username, null, 1, 100, function (repoData) {
                        self._trigger('onReceivedRepositories', null, repoData);
                        done(null, {user: userData, repos: repoData});
                    })
                },
                function (apiData, done) {
                    apiData.languages = {};

                    radic.async.each(apiData.repos, function(repo, next){

                        repo.updated_at_formatted = moment(repo.updated_at).format(self.options.repositoriesDateFormat);
                        var doLang = function(langData){
                            $.each(langData, function(i, lang){
                                if(typeof apiData.languages[i] === 'undefined'){
                                    apiData.languages[i] = lang;
                                } else {
                                    apiData.languages[i] += lang;
                                }
                            });
                        };

                        var cached = radic.storage.get('github-profile-widget-languages', {json: true});
                        if(cached) {
                            apiData.languages = cached.languages;
                            next();
                        } else {
                            radic.github.repos.languages(username, repo.name, function (langData) {
                                doLang(langData);
                                radic.storage.set('github-profile-widget-languages', {languages: apiData.languages}, {expires: 60, json: true});
                                next();
                            });
                        }
                    }, function(){

                        done(null, apiData)
                    })
                },
                function (data, done) {
                    data.topRepos = self._sortRepositories(data.repos);
                    done(null, data)
                },
                function (data, done) {
                    data.topLanguages = self._sortLanguages(data.languages);
                    callback(data);
                    done(null);

                }
            ])
        },

        _destroy: function () {
            this.element.html('');
            self._trigger('destroyed', null);
        },

        _setOption: function (key, value) {
            if (key === "disabled") {
                this.element
                    .toggleClass("ui-state-disabled", !!value)
                    .attr("aria-disabled", value);
            }
            this._super(key, value);
        }
    });

}));
