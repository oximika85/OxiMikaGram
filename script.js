// --- ۱. تنظیمات و اتصال Firebase 🔑 ---
// 🚨 توجه: این کد از سینتکس Firebase V8 و دسترسی سراسری (بدون import) استفاده می‌کند.

// ** 🚨 مهم **: این تنظیمات را باید با تنظیمات واقعی پروژه Firebase خود جایگزین کنید.
const firebaseConfig = {
    // تنظیمات ساختگی قبلی شما:
    apiKey: "AIzaSyAyGhDkqAwyCv-Sqa8z4BbkNa_SrpXv4Zk",
    authDomain: "mika-b7f7c.firebaseapp.com",
    databaseURL: "https://mika-b7f7c-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "mika-b7f7c",
};

// INITIALIZE APP با دسترسی سراسری
const app = firebase.initializeApp(firebaseConfig);
const database = firebase.database(app);
const auth = firebase.auth(app);
const messagesRef = database.ref('group_chat'); 

let currentUserUsername = null; // متغیری برای ذخیره نام کاربری لود شده

// --- ۲. مدیریت عناصر DOM (صفحه) 🏠 ---
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

const DARK_MODE_KEY = 'chat-app-dark-mode'; 


// --- ۳. توابع کمکی امنیتی و UI 🛡️ ---

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
 * تغییر حالت تیره
 */
function toggleDarkMode() {
    const isDark = document.documentElement.classList.contains('dark');
    setDarkMode(!isDark);
}

/**
 * نمایش/مخفی کردن پنل پروفایل
 */
function toggleProfilePanel() {
    // از کلاس‌های Tailwind برای ترنزیشن استفاده می‌شود
    const isPanelOpen = profilePanel.classList.contains('translate-x-0');
    
    if (isPanelOpen) {
        profilePanel.classList.remove('translate-x-0');
        profilePanel.classList.add('translate-x-full');
        // پنهان کردن واقعی پس از پایان ترنزیشن
        setTimeout(() => { profilePanel.classList.add('hidden'); }, 300);
    } else {
        profilePanel.classList.remove('hidden');
        profilePanel.classList.remove('translate-x-full');
        profilePanel.classList.add('translate-x-0');
    }
}


// --- ۴. توابع احراز هویت و ذخیره پروفایل 🆔 ---

// **ورود کاربر**
function loginUser() {
    const username = usernameAuthInput.value.trim();
    const password = passwordInput.value;
    const fakeEmail = `${username}@yourchatapp.com`;
    
    auth.signInWithEmailAndPassword(fakeEmail, password)
        .then(() => {
            customAlert("ورود موفق.");
        })
        .catch(error => {
            auth.signOut().finally(() => {
                if (error.code === 'auth/network-request-failed') {
                    customAlert("خطا در اتصال: اتصال به سرور چت مقدور نیست. لطفا ارتباط اینترنت را بررسی کنید.");
                } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                     customAlert("نام کاربری یا گذرواژه اشتباه است.");
                } else {
                    customAlert("خطا در ورود: " + error.message);
                }
                console.error("Login Error:", error);
            });
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
    
    // ۱. چک کردن نام کاربری در دیتابیس
    database.ref('usernames_map/' + username).once('value')
        .then(snapshot => {
            if (snapshot.exists()) {
                customAlert('این نام کاربری قبلاً استفاده شده است.');
                throw new Error('Username already exists'); 
            }
            
            const fakeEmail = `${username}@yourchatapp.com`;

            // ۲. ساخت اکانت در Auth
            return auth.createUserWithEmailAndPassword(fakeEmail, password);
        })
        .then(userCredential => {
            const uid = userCredential.user.uid;
            
            // ۳. ذخیره نگاشت نام کاربری به UID و اطلاعات پروفایل در RTDB
            const p1 = database.ref('usernames_map/' + username).set(uid);
            const p2 = database.ref('users/' + uid).set({ 
                username: username,
            });
            
            return Promise.all([p1, p2]);
        })
        .then(() => {
            customAlert(`ثبت نام ${username} با موفقیت انجام شد.`);
        })
        .catch(error => {
            if (error.code === 'auth/network-request-failed') {
                    customAlert("خطا در اتصال: اتصال به سرور چت مقدور نیست.");
            }
            else if (error.message !== 'Username already exists') {
                customAlert("خطا در ثبت نام: " + error.message);
            }
            console.error("Registration Error:", error);
        });
}

// **خروج کاربر**
function logoutUser() {
    auth.signOut()
        .then(() => {
            customAlert("خروج با موفقیت انجام شد.");
            messagesContainer.innerHTML = ''; 
        })
        .catch(error => {
            console.error("خطا در خروج:", error);
        });
}


// --- ۵. مدیریت وضعیت ورود (لود پروفایل) 🚪 ---

auth.onAuthStateChanged(user => {
    if (user) {
        // --- وضعیت: کاربر وارد شده ---
        
        // ۱. مخفی کردن کانتینر لاگین و نمایش کانتینر چت
        authContainer.classList.add('hidden');
        authContainer.classList.remove('flex');

        chatContainer.classList.remove('hidden');
        chatContainer.classList.add('flex'); // فعال کردن فلکس برای نمایش عمودی
        
        // ۲. لود اطلاعات پروفایل
        database.ref('users/' + user.uid).once('value')
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
                auth.signOut();
            });
    } else {
        // --- وضعیت: کاربر خارج شده ---
        
        // ۱. نمایش کانتینر لاگین و مخفی کردن کانتینر چت
        authContainer.classList.remove('hidden');
        authContainer.classList.add('flex'); // فعال کردن فلکس برای چیدمان
        
        chatContainer.classList.add('hidden');
        chatContainer.classList.remove('flex');

        // ۲. اطمینان از بسته بودن پنل پروفایل
        profilePanel.classList.remove('translate-x-0');
        profilePanel.classList.add('translate-x-full');
        profilePanel.classList.add('hidden');
    }
});


// --- ۶. منطق چت و ارسال/نمایش پیام 💬 ---

/**
 * رندر کردن یک حباب پیام در UI
 */
function renderMessage(messageData, currentUserName) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', 'rounded-xl', 'p-3', 'max-w-xs', 'shadow-sm', 'relative', 'mb-3');
    
    // تمایز پیام من و پیام دیگران
    if (messageData.name === currentUserName) {
        // پیام من: سمت راست، رنگ آبی
        messageDiv.classList.add('mine', 'bg-blue-500', 'text-white', 'self-start', 'ml-auto', 'rounded-br-sm');
    } else {
        // پیام دیگران: سمت چپ، رنگ سفید/خاکستری
        messageDiv.classList.add('other', 'bg-white', 'dark:bg-gray-700', 'text-gray-800', 'dark:text-white', 'self-start', 'rounded-bl-sm', 'mr-auto');
    }

    const senderSpan = document.createElement('span');
    senderSpan.classList.add('message-sender', 'block', 'text-xs', 'font-semibold', 'mb-1');
    senderSpan.textContent = messageData.name;
    
    // اعمال سبک رنگی بر اساس تم
    if (messageData.name === currentUserName) {
        senderSpan.classList.add('text-blue-200');
    } else {
        senderSpan.classList.add('text-gray-500', 'dark:text-gray-400');
    }
    
    // 🛑 ایجاد گره متنی امن برای محتوا 🛑
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
        timestamp: firebase.database.ServerValue.TIMESTAMP 
    };

    messagesRef.push(newMessage)
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
    
    // فقط ۵۰ پیام آخر را لود کن
    messagesRef.limitToLast(50).on('child_added', (snapshot) => {
        const messageData = snapshot.val();
        renderMessage(messageData, currentUserUsername);
        
        // اسکرول به پایین
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
}


// --- ۷. Event Listeners ---\
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


// --- ۸. راه‌اندازی تم Dark Mode در شروع ---
// چک کردن localStorage برای Dark Mode در هنگام لود شدن
window.onload = function() {
    const isDark = localStorage.getItem(DARK_MODE_KEY) === 'true';
    setDarkMode(isDark);
    
    // 💡 نکته: منطق onAuthStateChanged باید حالت نمایش اولیه را تنظیم کند،
    // اما برای اطمینان از این که در هنگام لود شدن صفحه، حداقل یک وضعیت نمایش داده شود:
    if (!auth.currentUser) {
        authContainer.classList.add('flex');
        authContainer.classList.remove('hidden');
        chatContainer.classList.add('hidden');
    } else {
        chatContainer.classList.add('flex');
        chatContainer.classList.remove('hidden');
        authContainer.classList.add('hidden');
    }
};
