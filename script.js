// --- ۱. ایمپورت‌های Firebase (ماژولار v11+) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getDatabase, 
    ref, 
    set, 
    push, 
    onChildAdded, 
    serverTimestamp,
    get, 
    child 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js";

// --- ۲. تنظیمات و متغیرهای سراسری ---

// ** 🚨 مهم: لطفاً تمام مقادیر زیر را با تنظیمات واقعی پروژه Firebase خود جایگزین کنید. **
const firebaseConfig = {
    apiKey: "YOUR_API_KEY", 
    authDomain: "YOUR_AUTH_DOMAIN.firebaseapp.com",
    // 🛑 شما باید مقدار زیر را با آدرس کامل Realtime Database خود جایگزین کنید.
    // مثال صحیح: https://my-chat-app-12345-default-rtdb.asia-southeast1.firebasedatabase.app
    databaseURL: "YOUR_DATABASE_URL_STARTING_WITH_HTTPS", 
    projectId: "YOUR_PROJECT_ID",
    // سایر فیلدها اختیاری هستند.
};

// ** 🛑 بررسی اعتبار سنجی URL دیتابیس (کمکی) 🛑 **
if (firebaseConfig.databaseURL === "YOUR_DATABASE_URL_STARTING_WITH_HTTPS" || !firebaseConfig.databaseURL.startsWith('http')) {
    console.error("==========================================================================================");
    console.error("🔥 خطای راه‌اندازی Firebase: مقدار databaseURL در script.js نامعتبر است!");
    console.error("🔥 لطفاً 'YOUR_DATABASE_URL_STARTING_WITH_HTTPS' را با آدرس کامل RTDB خود جایگزین کنید.");
    console.error("🔥 این آدرس باید با 'https://' شروع شود و از کنسول Firebase کپی شده باشد.");
    console.error("==========================================================================================");
    // اگر مقدار نامعتبر باشد، از اجرای برنامه جلوگیری نمی‌کند اما یک پیام اخطار شدید نمایش می‌دهد.
    // خطای اصلی همچنان از خود Firebase SDK صادر خواهد شد.
}


// ** راه‌اندازی Firebase **
const app = initializeApp(firebaseConfig);
const db = getDatabase(app); 
const auth = getAuth(app);

let currentUserUsername = null;

const DARK_MODE_KEY = 'chat-app-dark-mode'; 
const MESSAGES_REF_PATH = 'group_chat'; 

// --- ۳. مدیریت عناصر DOM (صفحه) 🏠 ---
const authContainer = document.getElementById('auth-container');
const chatContainer = document.getElementById('chat-container');

// عناصر احراز هویت
const usernameAuthInput = document.getElementById('auth-username'); 
const passwordInput = document.getElementById('auth-password');
const loginButton = document.getElementById('login-button');
const registerButton = document.getElementById('register-button');
const authMessage = document.getElementById('auth-message');

// عناصر چت
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const messagesContainer = document.getElementById('messages');

// عناصر پروفایل
const profilePanel = document.getElementById('profile-panel');
const profileToggle = document.getElementById('profile-toggle');
const profileCloseButton = document.getElementById('profile-close-button');
const profileUsername = document.getElementById('profile-username');
const profileUid = document.getElementById('profile-uid');
const logoutSwitchButton = document.getElementById('logout-switch-button');
const darkModeToggle = document.getElementById('dark-mode-toggle');


// --- ۴. توابع کمکی امنیتی و UI 🛡️ ---

/**
 * مدیریت نمایش صفحه چت یا ورود
 * @param {boolean} showChat - اگر true باشد، صفحه چت نمایش داده می‌شود، در غیر این صورت صفحه ورود.
 */
function switchView(showChat) {
    if (showChat) {
        // نمایش چت: flex
        chatContainer.classList.remove('hidden');
        chatContainer.classList.add('flex');
        // مخفی کردن ورود: hidden
        authContainer.classList.add('hidden');
        authContainer.classList.remove('flex');
    } else {
        // نمایش ورود: flex
        authContainer.classList.remove('hidden');
        authContainer.classList.add('flex');
        // مخفی کردن چت: hidden
        chatContainer.classList.add('hidden');
        chatContainer.classList.remove('flex');
    }
}

/**
 * تابع ضدعفونی کننده (Sanitize): برای جلوگیری از حملات XSS
 */
function sanitize(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * نمایش یک پیام به کاربر (جایگزین alert)
 */
function customAlert(message) {
    authMessage.textContent = message;
    authMessage.classList.remove('hidden');
    setTimeout(() => {
        authMessage.classList.add('hidden');
    }, 5000);
}

/**
 * تنظیم یا حذف حالت تیره
 */
function setDarkMode(isDark) {
    if (isDark) {
        document.documentElement.classList.add('dark');
        localStorage.setItem(DARK_MODE_KEY, 'true');
    } else {
        document.documentElement.classList.remove('dark');
        localStorage.removeItem(DARK_MODE_KEY);
    }
}

/**
 * سوئیچ بین حالت تیره و روشن
 */
function toggleDarkMode() {
    const isCurrentlyDark = document.documentElement.classList.contains('dark');
    setDarkMode(!isCurrentlyDark);
}

/**
 * نمایش/مخفی کردن پنل پروفایل
 */
function toggleProfilePanel() {
    const isPanelOpen = profilePanel.classList.contains('translate-x-0');
    
    if (isPanelOpen) {
        profilePanel.classList.remove('translate-x-0');
        profilePanel.classList.add('translate-x-full');
        setTimeout(() => { profilePanel.classList.add('hidden'); }, 300);
    } else {
        profilePanel.classList.remove('hidden');
        profilePanel.classList.remove('translate-x-full');
        profilePanel.classList.add('translate-x-0');
    }
}


// --- ۵. توابع احراز هویت و ذخیره پروفایل 🆔 ---

// **ورود کاربر**
function loginUser() {
    const username = usernameAuthInput.value.trim();
    const password = passwordInput.value;
    // Firebase Auth از ایمیل استفاده می‌کند، ما نام کاربری را به یک ایمیل ساختگی تبدیل می‌کنیم
    const fakeEmail = `${username}@yourchatapp.com`;
    
    signInWithEmailAndPassword(auth, fakeEmail, password)
        .then(() => {
            customAlert("ورود موفق.");
        })
        .catch(error => {
            handleAuthError(error);
        });
}

// **ثبت نام کاربر**
function registerUser() {
    const username = usernameAuthInput.value.trim();
    const password = passwordInput.value;
    
    if (username.length < 3 || password.length < 6) {
        customAlert("نام کاربری حداقل 3 و گذرواژه حداقل 6 کاراکتر باشد.");
        return;
    }
    
    const fakeEmail = `${username}@yourchatapp.com`;
    
    // ۱. چک کردن نام کاربری در دیتابیس
    get(child(ref(db), `usernames_map/${username}`))
        .then(snapshot => {
            if (snapshot.exists()) {
                customAlert('این نام کاربری قبلاً استفاده شده است.');
                // پرتاب خطا برای جلوگیری از اجرای ادامه Promise
                throw new Error('Username already exists'); 
            }
            
            // ۲. ساخت اکانت در Auth
            return createUserWithEmailAndPassword(auth, fakeEmail, password);
        })
        .then(userCredential => {
            const uid = userCredential.user.uid;
            
            // ۳. ذخیره نگاشت نام کاربری به UID و اطلاعات پروفایل در RTDB
            const p1 = set(ref(db, `usernames_map/${username}`), uid);
            const p2 = set(ref(db, `users/${uid}`), { 
                username: username,
            });
            
            return Promise.all([p1, p2]);
        })
        .then(() => {
            customAlert(`ثبت نام ${username} با موفقیت انجام شد.`);
        })
        .catch(error => {
            if (error.message !== 'Username already exists') {
                handleAuthError(error);
            }
        });
}

/**
 * تابع مرکزی مدیریت خطاهای Firebase Auth
 * @param {object} error - شیء خطای Firebase
 */
function handleAuthError(error) {
    let message = "خطای ناشناخته در احراز هویت.";
    console.error("Auth Error:", error.code, error.message);
    
    if (error.code === 'auth/network-request-failed') {
        message = "خطا در اتصال به سرور. ارتباط اینترنت را بررسی کنید.";
    } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        message = "نام کاربری یا گذرواژه اشتباه است.";
    } else if (error.code === 'auth/email-already-in-use') {
        message = "ایمیل (نام کاربری) قبلاً ثبت شده است.";
    } else if (error.code === 'auth/weak-password') {
        message = "گذرواژه ضعیف است. حداقل ۶ کاراکتر استفاده کنید.";
    } else if (error.code === 'app/invalid-url') {
        // این خطا مربوط به RTDB است، نه Auth، اما آن را شامل می‌کنیم.
        message = "خطا در URL پایگاه داده! لطفاً databaseURL را در script.js بررسی کنید.";
    }
    
    customAlert(message);
}

// **خروج کاربر**
function logoutUser() {
    signOut(auth)
        .then(() => {
            customAlert("خروج با موفقیت انجام شد.");
            messagesContainer.innerHTML = ''; 
        })
        .catch(error => {
            console.error("خطا در خروج:", error);
        });
}


// --- ۶. مدیریت وضعیت ورود (لود پروفایل) 🚪 ---

onAuthStateChanged(auth, (user) => {
    if (user) {
        // --- وضعیت: کاربر وارد شده ---
        switchView(true); // نمایش صفحه چت
        
        // لود اطلاعات پروفایل
        get(child(ref(db), `users/${user.uid}`))
            .then(snapshot => {
                const userData = snapshot.val();
                let username = "ناشناس";
                
                if (userData && userData.username) {
                    username = userData.username;
                }
                
                currentUserUsername = username; 
                
                // به‌روزرسانی پنل پروفایل
                profileUsername.textContent = username;
                profileUid.textContent = user.uid;
                
                // شروع گوش دادن به پیام‌ها
                startChatListeners(); 
            })
            .catch(error => {
                console.error("خطا در لود پروفایل:", error);
                // اگر لود پروفایل شکست خورد، بهتر است خارج شود
                signOut(auth);
            });
    } else {
        // --- وضعیت: کاربر خارج شده ---
        switchView(false); // نمایش صفحه ورود
        
        // اطمینان از بسته بودن پنل پروفایل
        profilePanel.classList.remove('translate-x-0');
        profilePanel.classList.add('translate-x-full');
        profilePanel.classList.add('hidden');
        
        // ریست کردن نام کاربری
        currentUserUsername = null;
    }
});


// --- ۷. منطق چت و ارسال/نمایش پیام 💬 ---

/**
 * رندر کردن یک حباب پیام در UI
 */
function renderMessage(messageData, currentUserName) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', 'rounded-xl', 'p-3', 'max-w-xs', 'shadow-sm', 'relative', 'mb-3', 'flex-shrink-0');
    
    const isMine = messageData.name === currentUserName;
    
    if (isMine) {
        // پیام من: سمت راست، رنگ آبی
        messageDiv.classList.add('bg-blue-500', 'text-white', 'ml-auto', 'rounded-br-sm');
    } else {
        // پیام دیگران: سمت چپ، رنگ سفید/خاکستری
        messageDiv.classList.add('bg-white', 'dark:bg-gray-700', 'text-gray-800', 'dark:text-white', 'mr-auto', 'rounded-bl-sm');
    }

    const senderSpan = document.createElement('span');
    senderSpan.classList.add('message-sender', 'block', 'text-xs', 'font-semibold', 'mb-1');
    senderSpan.textContent = messageData.name;
    
    if (isMine) {
        senderSpan.classList.add('text-blue-200');
    } else {
        senderSpan.classList.add('text-gray-500', 'dark:text-gray-400');
    }
    
    const sanitizedText = sanitize(messageData.text);
    const textNode = document.createTextNode(sanitizedText); 

    messageDiv.appendChild(senderSpan);
    messageDiv.appendChild(textNode);

    messagesContainer.appendChild(messageDiv);
}

function sendMessage() {
    const messageText = messageInput.value.trim();
    const currentUser = auth.currentUser;
    
    if (!currentUser || messageText === '') {
        return;
    }

    const sanitizedText = sanitize(messageText);

    const newMessage = {
        uid: currentUser.uid, 
        name: currentUserUsername, 
        text: sanitizedText, 
        timestamp: serverTimestamp() 
    };

    // push پیام به مسیر گروهی
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
    messagesContainer.innerHTML = ''; 
    
    const messagesQuery = ref(db, MESSAGES_REF_PATH);

    // استفاده از onChildAdded برای لود پیام‌های جدید و موجود
    onChildAdded(messagesQuery, (snapshot) => {
        const messageData = snapshot.val();
        if (currentUserUsername) {
            renderMessage(messageData, currentUserUsername);
        }
        
        // اسکرول به پایین (تأخیر جزئی برای رندر شدن حباب‌ها)
        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 100);
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


// --- ۹. راه‌اندازی اولیه ---
window.onload = function() {
    // ۱. لود وضعیت تم تیره
    const isDark = localStorage.getItem(DARK_MODE_KEY) === 'true';
    setDarkMode(isDark);
    
    // ۲. نمایش حالت پیش‌فرض (ورود) تا زمانی که AuthState مشخص شود.
    switchView(false); 
};
