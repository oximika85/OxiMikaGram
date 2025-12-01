// --- ۱. ایمپورت‌های Firebase (ماژولار v11+) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getDatabase, ref, set, push, onChildAdded, serverTimestamp, get
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js";

// --- ۲. تنظیمات و متغیرهای سراسری ---

// ** 🚨 مهم **: این تنظیمات باید با تنظیمات واقعی پروژه Firebase شما جایگزین شوند.
const firebaseConfig = {
    apiKey: "YOUR_API_KEY", // کلید API خود را اینجا قرار دهید
    authDomain: "YOUR_AUTH_DOMAIN",
    databaseURL: "YOUR_DATABASE_URL",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

let db;
let auth;
let currentUserUsername = null;

const DARK_MODE_KEY = 'chat-app-dark-mode'; 

// مسیرهای پایگاه داده
const MESSAGES_REF_PATH = 'group_chat'; 
const USERNAMES_MAP_REF_PATH = 'usernames_map'; 
const USERS_REF_PATH = 'users'; 

// --- ۳. المنت‌های UI ---
const body = document.body;
const authContainer = document.getElementById('auth-container'); 
const chatContainer = document.getElementById('chat-container');
const usernameAuthInput = document.getElementById('auth-username');
const passwordInput = document.getElementById('auth-password');
const loginButton = document.getElementById('login-button');
const registerButton = document.getElementById('register-button');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const messagesDiv = document.getElementById('messages');
const userIdDisplay = document.getElementById('user-id-display');
const headerTitle = document.getElementById('header-title');
const profileToggle = document.getElementById('profile-toggle');
const profilePanel = document.getElementById('profile-panel');
const profileCloseButton = document.getElementById('profile-close-button');
const logoutSwitchButton = document.getElementById('logout-switch-button');
const profileUsernameSpan = document.getElementById('profile-username');
const profileUidSpan = document.getElementById('profile-uid');
const darkModeToggle = document.getElementById('dark-mode-toggle');

// --- ۴. توابع کمکی ---

/**
 * مدیریت حالت تاریک
 */
function toggleDarkMode() {
    const isDarkMode = body.classList.toggle('dark');
    localStorage.setItem(DARK_MODE_KEY, isDarkMode ? 'enabled' : 'disabled');
    darkModeToggle.textContent = isDarkMode ? '☀️' : '🌙';
    darkModeToggle.title = isDarkMode ? 'تغییر به حالت روشن' : 'تغییر به حالت تاریک';
}

/**
 * بررسی وضعیت ذخیره شده و اعمال آن در شروع برنامه
 */
function applyInitialDarkMode() {
    const savedMode = localStorage.getItem(DARK_MODE_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    let shouldBeDark = (savedMode === 'enabled') || (savedMode === null && prefersDark);

    if (shouldBeDark) {
        body.classList.add('dark');
        darkModeToggle.textContent = '☀️';
        darkModeToggle.title = 'تغییر به حالت روشن';
    } else {
        body.classList.remove('dark');
        darkModeToggle.textContent = '🌙';
        darkModeToggle.title = 'تغییر به حالت تاریک';
    }
}

/**
 * رندر کردن یک پیام جدید در رابط کاربری
 */
function renderMessage(message, currentUsername) {
    const isOwner = message.name === currentUsername;
    
    const messageWrapper = document.createElement('div');
    messageWrapper.className = `message ${isOwner ? 'message-mine' : 'message-other'} w-full flex ${isOwner ? 'justify-end' : 'justify-start'}`;

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    
    const senderSpan = document.createElement('span');
    senderSpan.className = 'message-sender';
    senderSpan.textContent = message.name;

    const textParagraph = document.createElement('p');
    textParagraph.className = 'mt-1 text-base';
    textParagraph.textContent = message.text; 

    const timestampSpan = document.createElement('span');
    // تبدیل مهر زمان Unix به فرمت ساعت و دقیقه فارسی
    const timestampValue = message.timestamp || Date.now();
    const timestamp = new Date(timestampValue).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    
    timestampSpan.className = `text-xs ${isOwner ? 'text-white/70' : 'text-gray-400'} self-end`;
    timestampSpan.style.cssText = "margin-top: 5px;";
    timestampSpan.textContent = timestamp;

    bubble.appendChild(senderSpan);
    bubble.appendChild(textParagraph);
    bubble.appendChild(timestampSpan);
    messageWrapper.appendChild(bubble);

    messagesDiv.appendChild(messageWrapper);
}

/**
 * سوئیچ بین نمای احراز هویت و نمای چت
 */
function toggleUI(showChat) {
    authContainer.classList.toggle('hidden', showChat);
    authContainer.style.display = showChat ? 'none' : 'flex';
    
    chatContainer.classList.toggle('hidden', !showChat);
    chatContainer.style.display = showChat ? 'flex' : 'none';

    if (showChat) {
        profilePanel.classList.remove('open');
        profilePanel.classList.remove('hidden'); 
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        messageInput.focus();
    } else {
         profilePanel.classList.add('hidden'); 
    }
}

/**
 * نمایش پیام هشدار سفارشی
 */
function customAlert(message) {
    const existingAlert = document.getElementById('custom-alert');
    if (existingAlert) existingAlert.remove();
    
    const alertDiv = document.createElement('div');
    alertDiv.id = 'custom-alert';
    alertDiv.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-white p-3 rounded-xl shadow-lg z-50 transition-all duration-300';
    alertDiv.textContent = message;
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.remove();
    }, 3000);
}

/**
 * باز و بسته کردن پنل پروفایل
 */
function toggleProfilePanel() {
    profilePanel.classList.toggle('open');
}

// --- ۵. منطق Firebase/RTDB ---

function initFirebase() {
    try {
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getDatabase(app);
    } catch (error) {
        console.error("خطا در راه‌اندازی Firebase:", error);
        customAlert("خطا در راه‌اندازی: اتصال به سرور چت مقدور نیست.");
    }
}

/**
 * ورود کاربر
 */
function loginUser() {
    const username = usernameAuthInput.value.trim();
    const password = passwordInput.value;
    const fakeEmail = `${username}@yourchatapp.com`;
    
    if (username.length < 3 || password.length < 6) {
        customAlert("نام کاربری حداقل 3 و گذرواژه حداقل 6 کاراکتر باشد.");
        return;
    }
    
    loginButton.disabled = true;
    registerButton.disabled = true;
    
    signInWithEmailAndPassword(auth, fakeEmail, password)
        .catch(error => {
            if (error.code === 'auth/network-request-failed') {
                customAlert("خطا در اتصال: اتصال به سرور چت مقدور نیست.");
            } else {
                customAlert("خطا در ورود: نام کاربری یا گذرواژه اشتباه است.");
            }
            console.error("Login Error:", error);
        })
        .finally(() => {
            loginButton.disabled = false;
            registerButton.disabled = false;
        });
}

/**
 * ثبت نام کاربر
 */
function registerUser() {
    const username = usernameAuthInput.value.trim();
    const password = passwordInput.value;
    const fakeEmail = `${username}@yourchatapp.com`;

    if (username.length < 3 || password.length < 6) {
        customAlert("نام کاربری حداقل 3 و گذرواژه حداقل 6 کاراکتر باشد.");
        return;
    }
    
    loginButton.disabled = true;
    registerButton.disabled = true;

    // ۱: بررسی تکراری نبودن نام کاربری
    get(ref(db, `${USERNAMES_MAP_REF_PATH}/${username}`))
        .then(snapshot => {
            if (snapshot.exists()) {
                customAlert('این نام کاربری قبلاً استفاده شده است.');
                return Promise.reject(new Error('Username already exists')); 
            }
            
            // ۲: ساخت حساب کاربری
            return createUserWithEmailAndPassword(auth, fakeEmail, password);
        })
        .then(userCredential => {
            const uid = userCredential.user.uid;
            
            // ۳: ذخیره نگاشت نام کاربری به UID
            const p1 = set(ref(db, `${USERNAMES_MAP_REF_PATH}/${username}`), uid);
            const p2 = set(ref(db, `${USERS_REF_PATH}/${uid}`), { username: username });
            
            return Promise.all([p1, p2]);
        })
        .then(() => {
            customAlert(`ثبت نام ${username} با موفقیت انجام شد.`);
        })
        .catch(error => {
            if (error.message !== 'Username already exists') {
                if (error.code === 'auth/network-request-failed') {
                    customAlert("خطا در اتصال: اتصال به سرور چت مقدور نیست.");
                } else if (error.code === 'auth/email-already-in-use') {
                    customAlert("خطا: یک حساب کاربری با این نام وجود دارد. لطفا وارد شوید.");
                } else {
                     customAlert("خطا در ثبت نام: مشکلی پیش آمده است.");
                }
                console.error("Registration Error:", error);
            }
        })
        .finally(() => {
            loginButton.disabled = false;
            registerButton.disabled = false;
        });
}

/**
 * خروج کاربر
 */
function logoutUser() {
    signOut(auth)
        .then(() => {
            customAlert("خروج با موفقیت انجام شد. می‌توانید با اکانت دیگری وارد شوید.");
            currentUserUsername = null;
            messagesDiv.innerHTML = ''; 
            usernameAuthInput.value = '';
            passwordInput.value = '';
        })
        .catch(error => {
            console.error("خطا در خروج:", error);
        });
}

// --- ۶. مدیریت وضعیت ورود (onAuthStateChanged) ---

function setupAuthListener() {
    onAuthStateChanged(auth, user => {
        if (user) {
            get(ref(db, `${USERS_REF_PATH}/${user.uid}`))
                .then(snapshot => {
                    const userData = snapshot.val();
                    let username = (userData && userData.username) ? userData.username : "ناشناس";
                    
                    currentUserUsername = username;
                    
                    // به‌روزرسانی UI پروفایل
                    headerTitle.textContent = `چت گروهی: ${username}`; 
                    profileUsernameSpan.textContent = username; 
                    profileUidSpan.textContent = user.uid; 
                    userIdDisplay.textContent = `UID: ${user.uid}`;
                    userIdDisplay.classList.remove('hidden');
                    
                    toggleUI(true); 
                    startChatListeners();
                })
                .catch(error => {
                    console.error("خطا در دریافت اطلاعات کاربر:", error);
                    customAlert("خطا در بازیابی اطلاعات کاربر. دوباره وارد شوید.");
                    signOut(auth); 
                });
        } else {
            toggleUI(false); 
        }
    });
}

// --- ۷. منطق چت و ارسال پیام 💬 ---

function sendMessage() {
    const messageText = messageInput.value.trim();
    const currentUser = auth.currentUser;
    
    if (!currentUser || messageText === '' || !currentUserUsername) {
        return;
    }
    
    const newMessage = {
        uid: currentUser.uid,
        name: currentUserUsername,
        text: messageText,
        timestamp: serverTimestamp() 
    };
    
    push(ref(db, MESSAGES_REF_PATH), newMessage)
        .then(() => {
            messageInput.value = ''; 
            messageInput.focus();
        })
        .catch((error) => {
            console.error("خطا در ارسال پیام: ", error);
            customAlert("خطا در ارسال پیام. دوباره تلاش کنید.");
        });
}

/**
 * تنظیم شنونده بلادرنگ RTDB
 */
function startChatListeners() {
    messagesDiv.innerHTML = ''; 
    
    // onChildAdded: برای هر پیام جدید یا پیام‌های موجود
    onChildAdded(ref(db, MESSAGES_REF_PATH), (snapshot) => {
        const messageData = snapshot.val();
        renderMessage(messageData, currentUserUsername);
        
        // اسکرول به پایین
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    });
}


// --- ۸. Event Listeners ---

loginButton.addEventListener('click', loginUser);
registerButton.addEventListener('click', registerUser);
logoutSwitchButton.addEventListener('click', logoutUser); 
profileToggle.addEventListener('click', toggleProfilePanel); 
profileCloseButton.addEventListener('click', toggleProfilePanel); 
sendButton.addEventListener('click', sendMessage);
darkModeToggle.addEventListener('click', toggleDarkMode); 

// ارسال پیام با کلید Enter
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault(); 
        sendMessage();
    }
});


// --- ۹. راه‌اندازی برنامه ---
window.onload = () => {
    applyInitialDarkMode(); 
    initFirebase();
    if (auth) {
        setupAuthListener();
    } else {
        toggleUI(false);
    }
};