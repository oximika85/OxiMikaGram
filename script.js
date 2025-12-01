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
const usernameAuthInput = document.getElementById('auth-username'); 
const passwordInput = document.getElementById('auth-password');
const loginButton = document.getElementById('login-button');
const registerButton = document.getElementById('register-button');

// عناصر چت
const messageInput = document.getElementById('message-input');
const usernameInput = document.getElementById('username'); 
const sendButton = document.getElementById('send-button');
const messagesContainer = document.getElementById('messages');
const headerTitle = document.getElementById('header-title');

// ===================================================================
// ۳. توابع احراز هویت و ذخیره پروفایل (رفع خطای نادیده گرفتن رمز) 🆔
// ===================================================================

// **ورود کاربر (اصلاح حیاتی)**
function loginUser() {
    const username = usernameAuthInput.value.trim();
    const password = passwordInput.value;
    const fakeEmail = `${username}@yourchatapp.com`;
    
    auth.signInWithEmailAndPassword(fakeEmail, password)
        .then(() => {
            console.log("ورود موفق.");
        })
        .catch(error => {
            // 🚨 رفع مشکل: اگر ورود شکست خورد، فوراً نشست جاری را حذف کن
            auth.signOut().finally(() => {
                alert("خطا در ورود: " + error.message);
                console.error("Login Error:", error);
            });
        });
}

// **ثبت نام کاربر**
function registerUser() {
    const username = usernameAuthInput.value.trim();
    const password = passwordInput.value;
    
    if (username.length < 3 || password.length < 6) {
        alert("نام کاربری حداقل 3 و گذرواژه حداقل 6 کاراکتر باشد.");
        return;
    }
    
    database.ref('usernames_map/' + username).once('value')
        .then(snapshot => {
            if (snapshot.exists()) {
                alert('این نام کاربری قبلاً استفاده شده است.');
                throw new Error('Username already exists'); 
            }
            
            const fakeEmail = `${username}@yourchatapp.com`;

            return auth.createUserWithEmailAndPassword(fakeEmail, password);
        })
        .then(userCredential => {
            const uid = userCredential.user.uid;
            
            const p1 = database.ref('usernames_map/' + username).set(uid);
            const p2 = database.ref('users/' + uid).set({ 
                username: username,
            });
            
            return Promise.all([p1, p2]);
        })
        .then(() => {
            alert(`ثبت نام ${username} با موفقیت انجام شد.`);
        })
        .catch(error => {
            if (error.message !== 'Username already exists') {
                alert("خطا در ثبت نام: " + error.message);
            }
            console.error("Registration Error:", error);
        });
}

// **خروج کاربر**
function logoutUser() {
    auth.signOut()
        .then(() => {
            alert("خروج با موفقیت انجام شد.");
            messagesContainer.innerHTML = ''; 
        })
        .catch(error => {
            console.error("خطا در خروج:", error);
        });
}

loginButton.addEventListener('click', loginUser);
registerButton.addEventListener('click', registerUser);


// ===================================================================
// ۴. مدیریت وضعیت ورود (ورود دائمی و لود پروفایل) 🚪
// ===================================================================

auth.onAuthStateChanged(user => {
    if (user) {
        database.ref('users/' + user.uid).once('value')
            .then(snapshot => {
                const userData = snapshot.val();
                let username = "ناشناس";
                
                if (userData && userData.username) {
                    username = userData.username;
                }
                
                authContainer.style.display = 'none';
                chatContainer.style.display = 'flex';
                // اضافه کردن دکمه خروج
                headerTitle.innerHTML = `<button id="logout-button">خروج</button> چت گروهی: ${username}`; 
                
                startChatListeners(username); 
                
                // ⚠️ مهم: انتصاب رویداد به دکمه خروج جدید
                const newLogoutButton = document.getElementById('logout-button');
                if (newLogoutButton) {
                    newLogoutButton.addEventListener('click', logoutUser);
                }
            });

        if (usernameInput) usernameInput.style.display = 'none'; 

    } else {
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

    // گرفتن نام کاربری از هدر
    const username = headerTitle.textContent.replace("خروج چت گروهی: ", "").trim(); 
    
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

function startChatListeners(currentUserUsername) {
    messagesRef.on('child_added', (snapshot) => {
        const messageData = snapshot.val();
        
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        
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