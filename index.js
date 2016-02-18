/*

vNext

* make panel login work
* local cache for instant save/unsave UI
* some type of automatic bookmark<->pocket sync

*/

var self = require('sdk/self'),
    tabs = require('sdk/tabs'),
    buttons = require('sdk/ui/button/action'),
    button = null,
    hotkeys = require('sdk/hotkeys'),
    notifications = require('sdk/notifications'),
    Request = require('sdk/request').Request,
    key = '51343-d278ca50dc4358e630726fad',
    panelURI = self.data.url('pocket.html'),
    redirectURI = 'http://localhost/asdfasdf',
    panel = null,
    storage = require('sdk/simple-storage').storage,
    accessToken = storage.accessToken || null,
    username= storage.username || null,
    loggedIn = accessToken || 0,
    checkedCache = {},
    addonName = 'Doublestitch';

button = buttons.ActionButton({
  id: 'better-pocket',
  label: 'Save page to Pocket',
  icon: {
    '16': './favicon.ico'
  },
  onClick: handleClick
});

buttonHotkey = hotkeys.Hotkey({
  combo: 'accel-alt-w', //close to old-school Pocket addon shortcut
  onPress: function() {
    handleClick();
  }
});

function notify(text) {
  notifications.notify({
    text: text,
    iconURL: './favicon.ico'
  });
}

function handleClick() {
  if (!loggedIn) {
    notify('Please authorize with Pocket in this new tab before using ' + addonName + '.');
    login(function() {
      tabHandler(tabs.activeTab);
    });
  }
  else {
    urlIsSaved(tabs.activeTab.url, function(saved) {
      if (saved) {
        unsaveTab(tabs.activeTab, function() {
          // TODO unobtrusive user feedback, or is removal of ✓ badge enough?
        });
      }
      else {
        saveTab(tabs.activeTab, function() {
          // TODO unobtrusive user feedback, or is adding ✓ badge enough?
        });
      }
    });
  }
}

function urlIsSaved(url, cb) {
  if ((!loggedIn) || url.indexOf('about:') > -1) {
    cb(null);
    return;
  }
  if (checkedCache[url]) {
    cb(checkedCache[url]);
    return;
  }
  Request({
    url: 'https://getpocket.com/v3/get',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8'
    },
    content: JSON.stringify({
      consumer_key: key,
      access_token: accessToken,
      search: url,
      detailType: 'simple'
    }),
    onComplete: function(response) {
      var matches = null;
      try {
        var result = JSON.parse(response.text);
        if (result.list && Object.keys(result.list).length) {
          matches = response.json.list;
        }
      }
      catch(ex) {
        console.log('json parse error?', ex);
      }
      checkedCache[url] = matches;
      cb(matches)
    }
  }).post();
}

function saveTab(tab, cb) {
  Request({
    url: 'https://getpocket.com/v3/add',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8'
    },
    content: JSON.stringify({
      consumer_key: key,
      access_token: accessToken,
      url: tab.url,
      title: tab.title,
      tags: 'Firefox:Doublestitch'
    }),
    onComplete: function(response) {
      tabHandler(tab);
    }
  }).post();
}

function unsaveTab(tab, cb) {
  if (!checkedCache[tab.url]) {
    return; // WTF
  }
  Request({
    url: 'https://getpocket.com/v3/send',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8'
    },
    content: JSON.stringify({
      consumer_key: key,
      access_token: accessToken,
      actions: [{
        action: 'delete',
        item_id: Object.keys(checkedCache[tab.url])[0]
      }]
    }),
    onComplete: function(response) {
      delete checkedCache[tab.url];
      tabHandler(tab);
    }
  }).post();
}

function tabHandler(tab) {
  urlIsSaved(tab.url, function(saved) {
    button.badge = saved ? '✓' : '';
    button.badgeColor = 'silver';
  });
}

tabs.on('ready', tabHandler);
tabs.on('activate', tabHandler);

function login(cb) {
  var req = Request({
    url:' https://getpocket.com/v3/oauth/request',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Accept': 'application/x-www-form-urlencoded'
    },
    content: 'consumer_key=' + key + '&redirect_uri=' + redirectURI,
    onComplete: function (response) {
      if (response.status == 200) {
        var requestToken = response.text.split('=')[1];
        var pocketURL = 'https://getpocket.com/auth/authorize?'
          + 'request_token=' + requestToken
          + '&redirect_uri=' + redirectURI

        tabs.open({
          url: pocketURL,
          onOpen: function(tab) {
            tab.on('pageshow', function() {
              if (tab.url == redirectURI) {
                tab.close();
                afterRedirect();
              }
            });
          }
        });

        /*
        panel = require('sdk/panel').Panel({
          contentURL: pocketURL,
          contentScriptFile: './pocketDetector.js',
          width: 350,
          height: 500
        });
        panel.show({
          position: button
        });
        panel.port.on('unloaded', afterRedirect);
        */

        function afterRedirect() {
          Request({
            url: 'https://getpocket.com/v3/oauth/authorize',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
              'X-Accept': 'application/x-www-form-urlencoded'
            },
            content: 'consumer_key=' + key + '&code=' + requestToken,
            onComplete: function(response) {
              var parts = response.text.split('&');
              accessToken = storage.accessToken = parts[0].split('=')[1];
              username = storage.username = parts[1].split('=')[1];
              loggedIn = 1;
              cb();
              if (panel)
                panel.destroy();
            }
          }).post();
        }
      }
    }
  }).post()
}
