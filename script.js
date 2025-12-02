// ----------------------------------------------------------------------
// --- ۱. تنظیمات Firebase (پیکربندی شما) ---
// ----------------------------------------------------------------------
const firebaseConfig = {
    apiKey: "AIzaSyAyGhDkqAwyCv-Sqa8z4BbkNa_SrpXv4Zk",
    authDomain: "mika-b7f7c.firebaseapp.com",
    databaseURL: "https://mika-b7f7c-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "mika-b7f7c",
    storageBucket: "mika-b7f7c.firebasestorage.app",
    messagingSenderId: "524357269646",
    appId: "1:524357269646:web:89548b32616ebcbe4a31df"
};


// ----------------------------------------------------------------------
// --- ۲. راه‌اندازی و انتخاب عناصر DOM ---
// ----------------------------------------------------------------------
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const database = firebase.database();
    
    // عناصر Authentication و صفحات
    const authScreen = document.getElementById('authScreen');
    const passwordInput = document.getElementById('passwordInput');
    const usernameInput = document.getElementById('usernameInput');
    const registerButton = document.getElementById('registerButton');
    const loginButton = document.getElementById('loginButton');
    const authMessage = document.getElementById('authMessage');

    const chatListScreen = document.getElementById('chatListScreen');
    const contactsScreen = document.getElementById('contactsScreen');
    const chatScreen = document.getElementById('chatScreen');
    const profileScreen = document.getElementById('profileScreen');

    const newChatIcon = document.getElementById('newChatIcon');
    const contactsListArea = document.getElementById('contactsListArea');
    const chatListScroll = document.querySelector('.chat-list-scroll');

    const messagesArea = document.getElementById('messagesArea');
    const chatInput = document.getElementById('chatInput');
    const sendChatButton = document.getElementById('sendChatButton');
    const chatNameDetail = chatScreen.querySelector('.chat-name-detail');

    const userProfileUsername = document.getElementById('userProfileUsername');
    const userProfileUID = document.getElementById('userProfileUID');
    const newUsernameInput = document.getElementById('newUsernameInput');
    const updateUsernameButton = document.getElementById('updateUsernameButton');
    
    let currentUsername = null; 
    let currentUID = null;
    let chatRef = null;
    let userRegisteredUIDs = {}; 
    let currentChatId = 'project_channel'; 
    let currentChatName = 'کانال عمومی پروژه';
    
    // --- مراجع Firebase ---
    const usersRef = database.ref('users');
    const botQueueRef = database.ref('botQueue');
    const userChatsRef = (uid) => database.ref('userChats/' + uid);

    // ----------------------------------------------------------------------
    // --- ۳. توابع مدیریت UI و انیمیشن‌ها (رفع خطای ReferenceError) ---
    // ----------------------------------------------------------------------
    function showScreen(screenToShow) {
        [authScreen, chatListScreen, contactsScreen, chatScreen, profileScreen].forEach(screen => {
            if(screen) screen.classList.remove('active-screen');
        });
        if(screenToShow) screenToShow.classList.add('active-screen');
    }

    // ----------------------------------------------------------------------
    // --- ۴. امنیت (رفع XSS) و توابع چت ---
    // ----------------------------------------------------------------------

    function sanitizeText(text) {
        return text.replace(/&/g, '&amp;')
                   .replace(/</g, '&lt;')
                   .replace(/>/g, '&gt;')
                   .replace(/"/g, '&quot;')
                   .replace(/'/g, '&#039;');
    }
    
    function createMessageElement(username, text) {
        const messageDiv = document.createElement('div');
        const sanitizedText = sanitizeText(text); 
        
        messageDiv.innerHTML = `${sanitizedText} <span class="message-sender">(@${username})</span>`; 
        
        if (username === currentUsername) {
            messageDiv.classList.add('chat-message', 'my-chat-message');
        } else {
            messageDiv.classList.add('chat-message', 'other-chat-message');
        }
        return messageDiv;
    }

    function sendMessage() {
        const messageText = chatInput.value.trim();
        
        if (messageText !== "" && chatRef && currentUsername) {
            const messageData = {
                username: currentUsername,
                text: messageText,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                chatId: currentChatId 
            };
            
            chatRef.push(messageData).then(() => {
                chatInput.value = ''; 
                
                // 1. آپدیت نود userChats برای نمایش در لیست چت (Real-time)
                const messageUpdate = {
                    lastMessage: sanitizeText(messageText),
                    lastSender: currentUsername,
                    time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
                    name: currentChatName 
                };

                if (currentChatId.startsWith('private_')) {
                    const partners = currentChatId.split('_').slice(1);
                    partners.forEach(uid => {
                        const partnerRef = userChatsRef(uid).child(currentChatId);
                        // اگر خودمان فرستنده بودیم، پیام را خوانده شده فرض می‌کنیم
                        if (uid === currentUID) {
                             partnerRef.update({...messageUpdate, unread: false});
                        } else {
                             // برای مخاطب مقابل، پیام جدید خوانده نشده است
                             partnerRef.update({...messageUpdate, unread: true});
                        }
                    });
                } else {
                    // برای چت عمومی
                    userChatsRef(currentUID).child('project_channel').update({...messageUpdate, unread: false}); 
                }

                // 2. تشخیص و ارسال فرمان ربات (@atlas)
                if (messageText.toLowerCase().startsWith('@atlas')) {
                    botQueueRef.push({
                        sender: currentUsername,
                        command: messageText,
                        chatRefKey: chatRef.key, 
                        timestamp: firebase.database.ServerValue.TIMESTAMP
                    });
                    console.log("دستور ربات اطلس به صف ارسال شد.");
                }

            });
        }
    }
    
    function attachMessageListener(ref) {
        if (chatRef) {
             chatRef.off('child_added'); 
        }
        
        messagesArea.innerHTML = '';
        chatRef = ref; 
        
        chatRef.limitToLast(100).on('child_added', (snapshot) => {
            const message = snapshot.val();
            const messageElement = createMessageElement(message.username, message.text);
            messagesArea.appendChild(messageElement);
            messagesArea.scrollTop = messagesArea.scrollHeight;
        });
    }

    // ----------------------------------------------------------------------
    // --- ۵. مدیریت لیست چت دینامیک (Real-time List) ---
    // ----------------------------------------------------------------------
    
    function createChatItem(chatId, chatName, lastMsg, time, unread = false) {
        const item = document.createElement('div');
        item.classList.add('chat-item');
        if (unread) item.classList.add('unread');
        item.setAttribute('data-chat-id', chatId);
        
        // تعیین رنگ آواتار (می‌توانید با هش UID آن را دینامیک کنید)
        const avatarColor = chatId === 'project_channel' ? '#007aff' : '#ff9500';
        
        item.innerHTML = `
            <div class="avatar" style="background-color: ${avatarColor};"></div>
            <div class="content">
                <div class="content-top">
                    <span class="chat-name">${chatName}</span>
                    <span class="time">${time}</span>
                </div>
                <div class="last-message">
                    <span style="flex-grow: 1; overflow: hidden; text-overflow: ellipsis;">${lastMsg}</span>
                    <span class="unread-badge">!</span>
                </div>
            </div>
        `;
        return item;
    }

    function loadDynamicChatList() {
        chatListScroll.innerHTML = ''; 
        
        // 1. گوش دادن به لیست چت‌های کاربر فعلی
        userChatsRef(currentUID).on('value', (snapshot) => {
            // ساخت یک آرایه از آیتم‌ها برای مرتب‌سازی
            let chatItemsArray = [];
            
            snapshot.forEach(childSnapshot => {
                const chatId = childSnapshot.key;
                const chatData = childSnapshot.val();
                
                // unread: اگر آخرین فرستنده ما نبودیم و فیلد unread در دیتابیس true بود
                const isUnread = chatData.lastSender !== currentUsername && chatData.unread;

                const item = createChatItem(
                    chatId, 
                    chatData.name, 
                    sanitizeText(chatData.lastMessage || 'شروع گفتگو'), 
                    chatData.time || 'جدید',
                    isUnread
                );
                
                chatItemsArray.push({ element: item, chatId: chatId });
                
                item.addEventListener('click', () => {
                    currentChatId = chatId;
                    currentChatName = chatData.name;
                    item.classList.remove('unread');
                    
                    // تنظیم unread: false در دیتابیس هنگام باز کردن چت
                    userChatsRef(currentUID).child(chatId).update({unread: false});

                    chatNameDetail.textContent = currentChatName;
                    attachMessageListener(database.ref('chats/' + chatId));
                    showScreen(chatScreen);
                });
            });

            // 2. نمایش آیتم‌ها در لیست (می‌توانید اینجا بر اساس زمان مرتب کنید)
            chatListScroll.innerHTML = '';
            chatItemsArray.forEach(item => chatListScroll.appendChild(item.element));
            
            // 3. اگر کانال عمومی به طور خودکار در دیتابیس ثبت نشده بود، آن را اضافه کنید
            if(!document.querySelector('.chat-item[data-chat-id="project_channel"]')) {
                 const generalChannelItem = createChatItem('project_channel', 'کانال عمومی پروژه', 'در حال لود پیام...', 'اکنون');
                 chatListScroll.insertBefore(generalChannelItem, chatListScroll.firstChild);
            }
        });
    }

    // ----------------------------------------------------------------------
    // --- ۶. منطق Authentication ---
    // ----------------------------------------------------------------------
    
    // لود اولیه کاربران برای بررسی نام کاربری تکراری
    usersRef.once('value', snapshot => {
        snapshot.forEach(childSnapshot => {
            const userData = childSnapshot.val();
            userRegisteredUIDs[userData.username] = childSnapshot.key;
        });
    });

    registerButton.addEventListener('click', async () => {
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        if (!username || !password) { authMessage.textContent = 'لطفا نام کاربری و رمز عبور را پر کنید.'; return; }
        if (Object.keys(userRegisteredUIDs).includes(username)) { authMessage.textContent = 'این نام کاربری قبلاً ثبت شده است.'; return; }
        
        try {
            const fakeEmail = `${username}@mikachat.com`; 
            const userCredential = await auth.createUserWithEmailAndPassword(fakeEmail, password);
            const uid = userCredential.user.uid;
            
            await usersRef.child(uid).set({ username: username });
            // ایجاد چت عمومی در لیست چت کاربر جدید
            userChatsRef(uid).child('project_channel').set({
                 name: 'کانال عمومی پروژه', lastMessage: 'به چت روم خوش آمدید!', time: 'اکنون', lastSender: 'System', unread: false 
            });
            userRegisteredUIDs[username] = uid;
            authMessage.textContent = 'ثبت نام موفق! در حال ورود...';
        } catch (error) {
            authMessage.textContent = 'خطا در ثبت نام: ' + error.message;
        }
    });

    loginButton.addEventListener('click', async () => {
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        if (!username || !password) { authMessage.textContent = 'لطفا نام کاربری و رمز عبور را پر کنید.'; return; }
        
        const fakeEmail = `${username}@mikachat.com`; 
        try {
            await auth.signInWithEmailAndPassword(fakeEmail, password);
        } catch (error) {
            authMessage.textContent = 'خطا در ورود: نام کاربری یا رمز عبور اشتباه است.';
        }
    });

    document.getElementById('logoutButton').addEventListener('click', () => { auth.signOut(); });

    // ----------------------------------------------------------------------
    // --- ۷. مدیریت وضعیت کاربر و لود داده‌ها ---
    // ----------------------------------------------------------------------

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUID = user.uid;
            const snapshot = await usersRef.child(currentUID).once('value');
            const userData = snapshot.val();
            
            if (userData && userData.username) {
                currentUsername = userData.username;

                userProfileUID.textContent = currentUID;
                userProfileUsername.textContent = currentUsername;

                loadDynamicChatList(); 
                
                // اتصال به چت عمومی به عنوان چت پیش‌فرض
                document.querySelector('.chat-header .chat-name-detail').textContent = currentChatName;
                attachMessageListener(database.ref('chats/project_channel'));
                
                showScreen(chatListScreen);
            } else {
                auth.signOut();
            }
        } else {
            showScreen(authScreen);
        }
    });

    // ----------------------------------------------------------------------
    // --- ۸. مدیریت پروفایل، آیدی و مخاطبین ---
    // ----------------------------------------------------------------------
    
    updateUsernameButton.addEventListener('click', async () => {
        const newUsername = newUsernameInput.value.trim();
        if (!newUsername || newUsername === currentUsername) {
            alert("لطفاً یک آیدی جدید و معتبر وارد کنید.");
            return;
        }

        const usernameExists = Object.keys(userRegisteredUIDs).includes(newUsername);
        
        if (usernameExists && userRegisteredUIDs[newUsername] !== currentUID) {
            alert("این آیدی قبلاً توسط شخص دیگری استفاده شده است.");
            return;
        }
        
        try {
            await usersRef.child(currentUID).update({ username: newUsername });
            
            delete userRegisteredUIDs[currentUsername];
            userRegisteredUIDs[newUsername] = currentUID;
            currentUsername = newUsername;
            userProfileUsername.textContent = newUsername;
            newUsernameInput.value = '';
            
            alert("آیدی با موفقیت به " + newUsername + " تغییر یافت.");
        } catch (error) {
            alert("خطا در به‌روزرسانی آیدی: " + error.message);
        }
    });
    
    function loadContacts() {
        contactsListArea.innerHTML = '';
        usersRef.once('value', snapshot => {
            snapshot.forEach(childSnapshot => {
                const userData = childSnapshot.val();
                const uid = childSnapshot.key;
                
                if (uid !== currentUID) { 
                    const contactDiv = createChatItem(uid, userData.username, `@${userData.username}`, 'آیدی');
                    contactsListArea.appendChild(contactDiv);

                    contactDiv.addEventListener('click', () => startNewChat(userData.username, uid));
                }
            });
        });
    }

    function startNewChat(otherUsername, otherUID) {
        const chatPartnerIDs = [currentUID, otherUID].sort();
        const privateChatID = `private_${chatPartnerIDs[0]}_${chatPartnerIDs[1]}`;
        currentChatId = privateChatID;
        currentChatName = otherUsername;
        
        // اطمینان از وجود چت در لیست چت‌های ما و مخاطب
        userChatsRef(currentUID).child(privateChatID).once('value', snapshot => {
            if (!snapshot.exists()) {
                // ایجاد چت برای ما
                userChatsRef(currentUID).child(privateChatID).set({
                    name: otherUsername,
                    lastMessage: 'شروع گفتگو',
                    time: 'جدید',
                    lastSender: '',
                    unread: false
                });
                // ایجاد چت برای مخاطب
                userChatsRef(otherUID).child(privateChatID).set({
                    name: currentUsername,
                    lastMessage: 'شروع گفتگو',
                    time: 'جدید',
                    lastSender: '',
                    unread: false
                });
            }
        });

        chatNameDetail.textContent = otherUsername;
        attachMessageListener(database.ref('chats/' + privateChatID));
        showScreen(chatScreen);
    }
    
    // ----------------------------------------------------------------------
    // --- ۹. رویدادهای UI ---
    // ----------------------------------------------------------------------

    document.getElementById('profileIcon').addEventListener('click', () => { showScreen(document.getElementById('profileScreen')); });
    document.getElementById('backToChatListButton').addEventListener('click', () => { showScreen(chatListScreen); });
    
    newChatIcon.addEventListener('click', () => {
        loadContacts();
        showScreen(contactsScreen);
    });

    document.getElementById('backToChatListFromContacts').addEventListener('click', () => { showScreen(chatListScreen); });

    document.getElementById('backToListButton').addEventListener('click', () => { showScreen(chatListScreen); });
    sendChatButton.addEventListener('click', sendMessage);

    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); 
            sendMessage();
        }
    });

} else {
    console.error("Firebase library failed to load.");
}