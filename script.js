// ===================================================================
// ۱. تنظیمات و اتصال Firebase 🔑
// ===================================================================
const firebaseConfig = {
  apiKey: "AIzaSyAyGhDkqAwyCv-Sqa8z4BbkNa_SrpXv4Zk",
  authDomain: "mika-b7f7c.firebaseapp.com",
  databaseURL: "https://mika-b7f7c-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "mika-b7f7c",
  storageBucket: "mika-b7f7c.firebasestorage.app",
  messagingSenderId: "524357269646",
  appId: "1:524357269646:web:89548b32616ebcbe4a31df"
};

// INITIALIZE APP
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();
const messagesRef = database.ref('group_chat'); 

// ===================================================================
// ۲. مدیریت عناصر DOM (صفحه) 🏠
// ===================================================================
const authContainer = document.getElementById('auth-container');
const chatContainer = document.getElementById('chat-container');

// عناصر احراز هویت
const usernameAuthInput = document.getElementById('auth-username'); // 👈 ارجاع به فیلد نام کاربری در HTML
const passwordInput = document.getElementById('auth-password');
const loginButton = document.getElementById('login-button');
const registerButton = document.getElementById('register-button');

// عناصر چت
const messageInput = document.getElementById('message-input');
const usernameInput = document.getElementById('username'); // برای پنهان کردن (دیگر استفاده نمی‌شود)
const sendButton = document.getElementById('send-button');
const messagesContainer = document.getElementById('messages');
const headerTitle = document.getElementById('header-title');

// ===================================================================
// ۳. توابع احراز هویت و ذخیره پروفایل 🆔
// ===================================================================

// **ورود کاربر (با نام کاربری و پسورد)**
function loginUser() {
    const username = usernameAuthInput.value.trim();
    const password = passwordInput.value;
    const fakeEmail = `${username}@yourchatapp.com`; // ساخت ایمیل جعلی
    
    auth.signInWithEmailAndPassword(fakeEmail, password)
        .catch(error => {
            alert("خطا در ورود: " + error.message);
        });
}

// **ثبت نام کاربر (با نام کاربری یکتا)**
function registerUser() {
    const username = usernameAuthInput.value.trim();
    const password = passwordInput.value;
    
    if (username.length < 3 || password.length < 6) {
        alert("نام کاربری حداقل 3 و گذرواژه حداقل 6 کاراکتر باشد.");
        return;
    }
    
    // 1. بررسی یکتایی در دیتابیس (usernames_map)
    database.ref('usernames_map/' + username).once('value')
        .then(snapshot => {
            if (snapshot.exists()) {
                alert('این نام کاربری قبلاً استفاده شده است.');
                return;
            }
            
            const fakeEmail = `${username}@yourchatapp.com`;

            // 2. ثبت نام واقعی با Firebase Auth
            return auth.createUserWithEmailAndPassword(fakeEmail, password)
                .then(userCredential => {
                    const uid = userCredential.user.uid;
                    
                    // 3. ذخیره نام کاربری و پروفایل
                    const p1 = database.ref('usernames_map/' + username).set(uid);
                    const p2 = database.ref('users/' + uid).set({ 
                        username: username,
                    });
                    
                    return Promise.all([p1, p2]); // اجرای موازی
                });
        })
        .then(() => {
            alert(`ثبت نام ${username} با موفقیت انجام شد.`);
        })
        .catch(error => {
            alert("خطا در ثبت نام: " + error.message);
        });
}

loginButton.addEventListener('click', loginUser);
registerButton.addEventListener('click', registerUser);

// ===================================================================
// ۴. مدیریت وضعیت ورود (ورود دائمی و لود پروفایل) 🚪
// ===================================================================

auth.onAuthStateChanged(user => {
    if (user) {
        // کاربر وارد شده است، نام کاربری ذخیره شده را لود می‌کنیم
        database.ref('users/' + user.uid).once('value')
            .then(snapshot => {
                const userData = snapshot.val();
                let username = "ناشناس";
                
                if (userData && userData.username) {
                    username = userData.username;
                }
                
                // نمایش اطلاعات و چت
                authContainer.style.display = 'none';
                chatContainer.style.display = 'flex';
                headerTitle.textContent = "چت گروهی: " + username; 
                
                startChatListeners(username); // شروع شنیدن پیام‌ها
            });

        // حذف ورودی نام کاربری قدیمی
        if (usernameInput) usernameInput.style.display = 'none'; 

    } else {
        // کاربر وارد نشده است
        authContainer.style.display = 'flex';
        chatContainer.style.display = 'none';
    }
});


// ===================================================================
// ۵. منطق چت و ارسال پیام 💬
// ===================================================================

function sendMessage() {
    const messageText = messageInput.value.trim();
    const currentUser = auth.currentUser;
    
    if (!currentUser || messageText === '') {
        return;
    }

    // نام کاربری را از هدر لود می‌کنیم (که توسط auth.onAuthStateChanged تنظیم شده)
    const username = headerTitle.textContent.replace("چت گروهی: ", ""); 
    
    const newMessage = {
        uid: currentUser.uid, 
        name: username,
        text: messageText,
        timestamp: firebase.database.ServerValue.TIMESTAMP 
    };

    messagesRef.push(newMessage)
        .then(() => {
            messageInput.value = ''; 
        })
        .catch((error) => {
            console.error("خطا در ارسال پیام: ", error);
        });
}

sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// شنونده پیام‌ها
function startChatListeners(currentUserUsername) {
    messagesRef.on('child_added', (snapshot) => {
        const messageData = snapshot.val();
        
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        
        // تشخیص پیام خودی با مقایسه نام کاربری
        if (messageData.name === currentUserUsername) {
            messageDiv.classList.add('mine'); 
        } else {
             messageDiv.classList.add('other'); 
        }

        const senderSpan = document.createElement('span');
        senderSpan.classList.add('message-sender');
        senderSpan.textContent = messageData.name + ":";
        
        messageDiv.appendChild(senderSpan);
        messageDiv.innerHTML += messageData.text; 

        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
}