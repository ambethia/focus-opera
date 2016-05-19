var focusing     = false;
var whitelist    = false;
var blockedSites = [];
var redirectURL  = null;

function shouldBlockURL(url) {
  var shouldBlock = whitelist;
  if (!focusing) return false;
  if (url === undefined) return false;
  if (blockedSites.length == 0 && whitelist) return false;
  if (url.indexOf("http://") !== 0 && url.indexOf("https://") !== 0) return false;
  for (var i = 0; i < blockedSites.length; i++) {
    var blockedSite = blockedSites[i];
    var siteRegex = new RegExp(blockedSite.regexUrlStr);
    if (siteRegex.test(url)) {
      if (whitelist || blockedSite.whitelist) return false;
      shouldBlock = true;
    }
  }
  return shouldBlock;
}

function checkForFocus(tabId, url) {
  if (focusing) {
    if (shouldBlockURL(url)) {
      chrome.tabs.update(tabId, { url: redirectURL + "?focus_url=" + encodeURIComponent(url) });
    }
  } else {
    var focusURL = getParameterByName("focus_url", url);
    if (focusURL) chrome.tabs.update(tabId, { url: focusURL });
  }
}

function checkAllTabs() {
  chrome.windows.getAll({ populate: true }, function(windowList) {
    for (var i = 0; i < windowList.length; i++) {
      for (var j = 0; j < windowList[i].tabs.length; j++) {
        var tab = windowList[i].tabs[j];
        checkForFocus(tab.id, tab.url);
      }
    }
  });
}

function createWebSocket() {
  var ws = new WebSocket("ws://localhost:8918/firefox");

  ws.onopen = function() {
    ws.send(JSON.stringify({
      "msg": "ping",
      "platform": "opera",
      "version": "1.3" // Avoid pop-up from Focus app
    }));
  };

  ws.onclose = function() {
    setTimeout(function () {
      createWebSocket();
    }, 1000);
  };

  ws.onmessage = function(evt) {
    var data = JSON.parse(evt.data);
    switch (data.msg) {
      case "focus":
        focusing = true;
        whitelist = data.whitelist;
        blockedSites = data.regexSites;
        redirectURL = data.redirectURL;
        checkAllTabs();
        break;
      case "unfocus":
        focusing = false;
        whitelist = false;
        blockedSites = [];
        if (!data.disableRefreshOnUnfocus) {
          checkAllTabs();
        }
        break;
    }
  };
}

function getParameterByName(name, url) {
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}

chrome.webNavigation.onBeforeNavigate.addListener(function(details) {
  checkForFocus(details.tabId, details.url);
});

createWebSocket();
