// ===================================================================
// ۱. تنظیمات Firebase (با مقادیر واقعی پروژه شما)
// ===================================================================
const firebaseConfig = {
  apiKey: "AIzaSyAyGhDkqAwyCv-Sqa8z4BbkNa_SrpXv4Zk", // این مقدار باید در این فایل باشد
  authDomain: "mika-b7f7c.firebaseapp.com",
  databaseURL: "https://mika-b7f7c-default-rtdb.europe-west1.firebasedatabase.app", // آدرس دیتابیس شما (ممکن است متفاوت باشد)
  projectId: "mika-b7f7c",
  storageBucket: "mika-b7f7c.firebasestorage.app",
  messagingSenderId: "524357269646",
  appId: "1:524357269646:web:89548b32616ebcbe4a31df"
};

// کتابخانه‌های Firebase را از لینک‌های CDN لود می‌کنیم
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const messagesRef = database.ref('chat_messages'); 

// ===================================================================
// ۲. بقیه کدهای منطقی چت
// ===================================================================

const messageInput = document.getElementById('message-input');
const usernameInput = document.getElementById('username');
const sendButton = document.getElementById('send-button');
const messagesContainer = document.getElementById('messages');

function sendMessage() {
    const messageText = messageInput.value.trim();
    const username = usernameInput.value.trim() || "ناشناس";
    
    if (messageText === '') {
        return;
    }

    const newMessage = {
        name: username,
        text: messageText,
        timestamp: Date.now() 
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

messagesRef.on('child_added', (snapshot) => {
    const messageData = snapshot.val();
    
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    messageDiv.classList.add('other'); 

    const senderSpan = document.createElement('span');
    senderSpan.classList.add('message-sender');
    senderSpan.textContent = messageData.name + ":";
    
    messageDiv.appendChild(senderSpan);
    messageDiv.innerHTML += messageData.text; 

    messagesContainer.appendChild(messageDiv);

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
});