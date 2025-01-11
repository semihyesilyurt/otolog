const PROXY_HOST = "77.92.154.204";
const PROXY_PORT = 8888;

const proxyDomains = [
  "partslink24.com",
  "usercentrics.eu",
  "go-mpulse.net",
  "doubleclick.net",
  "googletagmanager.com",
];

// PAC script oluşturma
function generatePacScript() {
  const domains = JSON.stringify(proxyDomains).replace(/[^\x00-\x7F]/g, "");
  return `
    function FindProxyForURL(url, host) {
      var proxyDomains = ${domains};
      
      function checkDomain(domain) {
        return shExpMatch(host, "*." + domain) || shExpMatch(host, domain);
      }

      for (var i = 0; i < proxyDomains.length; i++) {
        if (checkDomain(proxyDomains[i])) {
          return "PROXY ${PROXY_HOST}:${PROXY_PORT}";
        }
      }

      return "DIRECT";
    }
  `.replace(/[^\x00-\x7F]/g, "");
}

// SSL Sertifika kontrolü
async function checkCertificate() {
    try {
        const response = await fetch('https://otolog.com/api/check-cert', {
            method: 'HEAD'
        });
        return response.ok;
    } catch (error) {
        if (error.message.includes('SSL')) {
            return false;
        }
        return true;
    }
}

// Sertifika uyarısı göster
function showCertificateWarning() {
    chrome.notifications.create('cert-warning', {
        type: 'basic',
        iconUrl: 'images/icon128.png',
        title: 'SSL Sertifika Hatası',
        message: 'Güvenli bağlantı için sertifika kurulumu gerekiyor. Kurulum rehberini görüntülemek için tıklayın.',
        requireInteraction: true
    });
}

// Notification tıklama olayını dinle
chrome.notifications.onClicked.addListener((notificationId) => {
    if (notificationId === 'cert-warning') {
        chrome.tabs.create({
            url: chrome.runtime.getURL('pages/cert_guide.html')
        });
    }
});

// Eklenti aktif/pasif durumu kontrolü
let isEnabled = false;
let isSubscriptionExpired = false;
let isAuthenticated = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "getProxyStatus") {
        sendResponse({ isEnabled });
    } else if (message.action === "setAuthStatus") {
        isAuthenticated = message.isAuthenticated;
        if (!isAuthenticated) {
            // Oturum yoksa sistemi devre dışı bırak
            isEnabled = false;
            chrome.proxy.settings.set({
                value: { mode: "direct" },
                scope: "regular"
            });
        }
        sendResponse({ success: true });
    } else if (message.action === "toggleProxy") {
        // Oturum yoksa sistemi etkinleştirmeyi reddet
        if (!isAuthenticated) {
            sendResponse({ 
                isEnabled: false,
                error: "Sistem kullanımı için giriş yapmanız gerekiyor"
            });
            return true;
        }

        // Eğer forceDisable true ise, abonelik sona ermiş demektir
        if (message.forceDisable) {
            isSubscriptionExpired = true;
            isEnabled = false;
        } else if (isSubscriptionExpired) {
            sendResponse({ 
                isEnabled: false,
                error: "Aboneliğiniz sona erdiği için sistem etkinleştirilemiyor"
            });
            return true;
        } else {
            isEnabled = message.enable !== undefined ? message.enable : !isEnabled;
        }
        
        if (isEnabled && !isSubscriptionExpired && isAuthenticated) {
            chrome.proxy.settings.set({
                value: {
                    mode: "pac_script",
                    pacScript: {
                        data: generatePacScript()
                    }
                },
                scope: "regular"
            });
        } else {
            chrome.proxy.settings.set({
                value: { mode: "direct" },
                scope: "regular"
            });
        }
        
        sendResponse({ isEnabled });
    }
    return true;
});

// Eklenti yüklendiğinde veya güncellendiğinde çalışacak
chrome.runtime.onInstalled.addListener(async () => {
    chrome.proxy.settings.set({
        value: { mode: "direct" },
        scope: "regular"
    });
    isEnabled = false;
    isSubscriptionExpired = false;
    isAuthenticated = false;
}); 

// Sistem hataları için listener
chrome.proxy.onProxyError.addListener(function(details) {
    console.error("Sistem hatası:", details);
}); 