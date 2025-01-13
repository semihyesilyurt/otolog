// Supabase yapılandırması
const SUPABASE_URL = 'https://vjdbbbgfnebdptyfmnkx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqZGJiYmdmbmViZHB0eWZtbmt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY1MzE4MzQsImV4cCI6MjA1MjEwNzgzNH0.67HlAfvqrg_Yua7jKbjt7YrT7PeLA9BjNKa6MIR0fWY';

// Supabase client'ı window yüklendikten sonra oluştur
let supabaseClient;

document.addEventListener('DOMContentLoaded', async () => {
    // Supabase istemcisini başlat
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true
        },
        global: {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Prefer': 'return=representation'
            },
        }
    });

    // Mevcut oturum kontrolü
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();

    // Background script'e oturum durumunu bildir
    await chrome.runtime.sendMessage({ 
        action: "setAuthStatus", 
        isAuthenticated: !!session 
    });

    if (session) {
        window.location.href = 'dashboard.html';
        return;
    }

    const loginForm = document.getElementById('loginForm');
    const companyCodeInput = document.getElementById('companyCode');
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
        
        // Beni hatırla durumunu ayarla
        rememberMeCheckbox.checked = !!rememberMe;
        
        // Eğer beni hatırla aktifse ve kayıtlı bilgiler varsa
        if (rememberMe && credentials) {
            companyCodeInput.value = credentials.companyCode;
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
            companyCode: companyCodeInput.value,
            username: usernameInput.value,
            password: passwordInput.value
        };

        try {
            // Önce firma kodunu kontrol et
            const { data: companies, error: companyError } = await supabaseClient
                .from('companies')
                .select('id')
                .eq('code', credentials.companyCode)
                .single();

            if (companyError) {
                console.error('Firma kodu kontrolü hatası:', companyError);
                throw new Error('Geçersiz firma kodu');
            }

            if (!companies) {
                throw new Error('Firma bulunamadı');
            }

            // Supabase ile kimlik doğrulama
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: credentials.username,
                password: credentials.password
            });

            if (error) throw error;

            // Background script'e başarılı giriş bildir
            await chrome.runtime.sendMessage({ 
                action: "setAuthStatus", 
                isAuthenticated: true 
            });

            // Diğer oturumları sonlandır
            try {
                // Tüm oturumları sonlandır ve yeni oturum oluştur
                await supabaseClient.auth.signOut({ scope: 'others' });
                console.log('Diğer oturumlar sonlandırıldı');
            } catch (sessionError) {
                console.error('Oturum sonlandırma hatası:', sessionError);
            }

            // Beni hatırla seçeneği işaretliyse bilgileri kaydet
            if (rememberMeCheckbox.checked) {
                await chrome.storage.local.set({
                    credentials: {
                        companyCode: credentials.companyCode,
                        username: credentials.username
                    },
                    rememberMe: true
                });
            } else {
                // Kayıtlı bilgileri temizle
                await chrome.storage.local.remove(['credentials']);
                await chrome.storage.local.remove(['rememberMe']);
            }

            // Proxy'yi etkinleştir
            await chrome.runtime.sendMessage({ 
                action: "toggleProxy", 
                enable: true 
            });

            // Başarılı giriş - ana sayfaya yönlendir
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