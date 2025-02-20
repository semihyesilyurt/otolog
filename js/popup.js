// Supabase yapılandırması

// Supabase client'ı window yüklendikten sonra oluştur
let supabaseClient;

document.addEventListener('DOMContentLoaded', async () => {
    // Mevcut bir oturum varsa direkt dashboard sayfasına yönlendir.
    const { sessionData } = await chrome.storage.local.get(['sessionData']);
    if (sessionData) {
        window.location.href = 'dashboard.html';
        return;
    }
    
    // Supabase istemcisi oluşturma ve oturum kontrolü kısmı kaldırıldı.
    
    const loginForm = document.getElementById('loginForm');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const rememberMeCheckbox = document.getElementById('rememberMe');
    const loginButton = document.querySelector('.login-btn');

    // Hata mesajı gösterme fonksiyonu
    const showError = (message) => {
        const existingError = document.querySelector('.error-message');
        if (existingError) existingError.remove();
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        loginForm.appendChild(errorDiv);
    };

    // Kayıtlı bilgileri yükle
    try {
        const { credentials, rememberMe } = await chrome.storage.local.get(['credentials', 'rememberMe']);
        
        rememberMeCheckbox.checked = !!rememberMe;
        
        if (rememberMe && credentials) {
            usernameInput.value = credentials.username;
        }
    } catch (error) {
        console.error('Kayıtlı bilgiler yüklenirken hata:', error);
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginButton.disabled = true;
        loginButton.textContent = 'Giriş Yapılıyor...';

        const credentials = {
            email: usernameInput.value, // E-posta adresi
            password: passwordInput.value
        };

        try {
            // Giriş isteğini özel endpoint'e gönderiyoruz
            const response = await fetch('http://77.92.154.204:8887/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(credentials)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Giriş yapılırken bir hata oluştu');
            }

            // Başarılı giriş—login endpoint'inin döndürdüğü JSON (access_token, user, subscription)
            const data = await response.json();

            // Oturum bilgisini chrome storage'da sakla
            await chrome.storage.local.set({ sessionData: data });

            // Background script'e oturum durumunu bildir
            await chrome.runtime.sendMessage({ 
                action: "setAuthStatus", 
                isAuthenticated: true,
                userEmail: data.user.email
            });

            // "Beni Hatırla" seçili ise bilgileri sakla.
            if (rememberMeCheckbox.checked) {
                await chrome.storage.local.set({
                    credentials: { username: usernameInput.value },
                    rememberMe: true
                });
            } else {
                await chrome.storage.local.remove(['credentials', 'rememberMe']);
            }

            // Proxy'yi etkinleştir
            await chrome.runtime.sendMessage({ 
                action: "toggleProxy", 
                enable: true 
            });

            // Başarılı giriş sonrası dashboard sayfasına yönlendir.
            window.location.href = 'dashboard.html';

        } catch (error) {
            console.error('Giriş hatası:', error);
            showError(error.message || 'Giriş yapılırken bir hata oluştu');
        } finally {
            loginButton.disabled = false;
            loginButton.textContent = 'Giriş Yap';
        }
    });
}); 