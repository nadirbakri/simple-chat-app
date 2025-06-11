import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import { chatAPI } from '../lib/api'
import ChatList from '../components/ChatList'
import ChatWindow from '../components/ChatWindow'
import AddChatModal from '../components/AddChatModal'

export default function Chat() {
    const [currentUserId, setCurrentUserId] = useState('')
    const [chats, setChats] = useState([])
    const [currentChat, setCurrentChat] = useState(null)
    const [messages, setMessages] = useState({})
    const [showAddModal, setShowAddModal] = useState(false)
    const [isOnline, setIsOnline] = useState(true)
    const [lastActivity, setLastActivity] = useState(0)
    const [isClient, setIsClient] = useState(false)
    const [isRegistering, setIsRegistering] = useState(false)
    const router = useRouter()

    const handleMarkAsRead = useCallback(async (chatWith) => {
        if (!currentUserId || !chatWith || currentUserId.trim() === '' || chatWith.trim() === '') {
            console.log('⚠️ Invalid parameters for mark as read:', { currentUserId, chatWith })
            return
        }
        
        try {
            await chatAPI.markAsRead(currentUserId.trim(), chatWith.trim())
            console.log(`👁️ Marked ${chatWith} as read`)
            
            setChats(prevChats => 
                prevChats.map(chat => 
                    chat.id === chatWith 
                        ? { ...chat, unreadCount: 0, hasUnread: false }
                        : chat
                )
            )
        } catch (err) {
            console.error('❌ Failed to mark as read:', err.message)
        }
    }, [currentUserId])

    useEffect(() => {
        setIsClient(true)
        setLastActivity(Date.now())
    }, [])

    useEffect(() => {
        if (!isClient) return
        
        const storedUserId = localStorage.getItem('currentUserId')
        
        console.log('🔍 Checking stored userId:', storedUserId)
        
        if (!storedUserId || 
            storedUserId.trim() === '' || 
            storedUserId === 'null' || 
            storedUserId === 'undefined' ||
            storedUserId.length < 1) {
            
            console.log('❌ Invalid or missing userId, redirecting to home')
            router.push('/')
            return
        }
        
        const cleanUserId = storedUserId.trim()
        console.log('✅ Valid userId found:', cleanUserId)
        setCurrentUserId(cleanUserId)
        registerUser(cleanUserId)
        
    }, [isClient, router])

    const registerUser = async (userId) => {
        if (isRegistering) {
            console.log('⚠️ Registration already in progress')
            return
        }
        
        setIsRegistering(true)
        
        try {
            console.log('🔄 Registering user:', userId)
            const result = await chatAPI.register(userId)
            console.log('✅ User registered successfully:', result)
            setIsOnline(true)
            loadChats(userId)
        } catch (err) {
            console.error('❌ Registration failed:', err.message)
            setIsOnline(false)
            
            if (err.message.includes('Missing') || err.message.includes('empty')) {
                console.log('❌ Critical error, redirecting to home')
                router.push('/')
                return
            }
        } finally {
            setIsRegistering(false)
        }
    }

    useEffect(() => {
        if (!currentUserId || currentUserId.trim() === '' || isRegistering) {
            console.log('⚠️ Skipping polling - no valid userId or still registering')
            return
        }
        
        console.log('🔄 Starting polling for user:', currentUserId)
        
        const pollInterval = setInterval(() => {
            const userId = currentUserId.trim()
            if (!userId) return
            
            console.log('⏰ Polling update...')
            loadChats(userId)
            
            if (currentChat && currentChat.id) {
                loadMessages(userId, currentChat.id)
            }

            setLastActivity(Date.now())
        }, 3000)
        
        return () => {
            console.log('🛑 Stopping polling for user:', currentUserId)
            clearInterval(pollInterval)
        }
    }, [currentUserId, currentChat?.id, isRegistering])

    const loadChats = async (userId) => {
        if (!userId || userId.trim() === '') {
            console.log('⚠️ Invalid userId for loadChats:', userId)
            return
        }
        
        try {
            console.log('📋 Loading chats for:', userId)
            const result = await chatAPI.getChats(userId.trim())
            
            console.log('📋 Chats loaded:', result.chats?.length || 0)
            
            setChats(prevChats => {
                const newChats = result.chats || []
                
                if (prevChats.length === newChats.length && 
                    JSON.stringify(prevChats.map(c => ({ id: c.id, lastMessageTime: c.lastMessageTime }))) === 
                    JSON.stringify(newChats.map(c => ({ id: c.id, lastMessageTime: c.lastMessageTime })))) {
                
                    return prevChats.map(prevChat => {
                        const newChat = newChats.find(nc => nc.id === prevChat.id)
                        return newChat ? { ...prevChat, ...newChat } : prevChat
                    })
                }
                
                console.log('📋 Chats updated with new data')
                return newChats
            })
            
            setIsOnline(true)
        } catch (err) {
            console.error('❌ Failed to load chats:', err.message)
            setIsOnline(false)
            
            if (err.message.includes('Missing') || err.message.includes('empty')) {
                console.log('❌ User session might be invalid, re-registering...')
                registerUser(userId)
            }
        }
    }

    const loadMessages = async (userId, chatWith) => {
        if (!userId || !chatWith || userId.trim() === '' || chatWith.trim() === '') {
            console.log('⚠️ Invalid parameters for loadMessages:', { userId, chatWith })
            return
        }
        
        try {
            console.log('📥 Loading messages for chat:', chatWith)
            const result = await chatAPI.getMessages(userId.trim(), chatWith.trim())
            const newMessages = result.messages || []
            
            console.log('📥 Messages loaded:', newMessages.length)
            
            setMessages(prev => {
                const existingMessages = prev[chatWith] || []
                if (existingMessages.length === newMessages.length &&
                    JSON.stringify(existingMessages.map(m => m.id)) === JSON.stringify(newMessages.map(m => m.id))) {
                    return prev
                }
                
                console.log('📥 Messages updated for chat:', chatWith)
                return {
                    ...prev,
                    [chatWith]: newMessages
                }
            })
            
            setIsOnline(true)
        } catch (err) {
            console.error('❌ Failed to load messages:', err.message)
            setIsOnline(false)
        }
    }

    const handleAddChat = async (searchId) => {
        console.log('🔍 Searching for user:', searchId)
        
        if (!searchId || searchId.trim() === '') {
            throw new Error('User ID tidak boleh kosong!')
        }
        
        const cleanSearchId = searchId.trim()
        const cleanCurrentUserId = currentUserId.trim()
        
        if (cleanSearchId === cleanCurrentUserId) {
            throw new Error('Tidak bisa chat dengan diri sendiri!')
        }

        const existingChat = chats.find(chat => chat.id === cleanSearchId)
        if (existingChat) {
            throw new Error('Chat sudah ada!')
        }

        try {
            const result = await chatAPI.searchUser(cleanCurrentUserId, cleanSearchId)
            
            if (result.exists) {
                console.log('✅ User found, chat relationship created on server!')
                
                const newChat = {
                    id: cleanSearchId,
                    name: cleanSearchId,
                    lastMessage: '',
                    lastMessageTime: null,
                    unreadCount: 0,
                    hasUnread: false
                }
                
                setChats(prev => [...prev, newChat])

                setTimeout(() => loadChats(cleanCurrentUserId), 500)
                
                console.log('✅ Chat berhasil ditambahkan!')
            } else {
                throw new Error('User tidak ditemukan atau sedang offline!')
            }
        } catch (err) {
            console.error('❌ Add chat failed:', err.message)
            throw err
        }
    }

    const handleSendMessage = async (message) => {
        if (!currentChat || !currentUserId || !message || message.trim() === '') {
            console.log('⚠️ Invalid parameters for send message')
            return
        }

        try {
            const cleanMessage = message.trim()
            const cleanUserId = currentUserId.trim()
            const cleanChatId = currentChat.id.trim()
            
            console.log('📨 Sending message:', { from: cleanUserId, to: cleanChatId, message: cleanMessage })
            
            const result = await chatAPI.sendMessage(cleanUserId, cleanChatId, cleanMessage)
            console.log('📨 Message sent successfully:', result.message?.id)
            
            const messageData = result.message
            
            setMessages(prev => ({
                ...prev,
                [cleanChatId]: [...(prev[cleanChatId] || []), messageData]
            }))
            
            setChats(prev => prev.map(chat => 
                chat.id === cleanChatId 
                    ? { 
                        ...chat, 
                        lastMessage: cleanMessage, 
                        lastMessageTime: messageData.timestamp 
                      }
                    : chat
            ))
            
            setTimeout(() => {
                loadMessages(cleanUserId, cleanChatId)
                loadChats(cleanUserId)
            }, 100)
        } catch (err) {
            console.error('❌ Failed to send message:', err.message)
            
            alert('Gagal mengirim pesan: ' + err.message)
        }
    }

    const handleLogout = () => {
        console.log('👋 Logging out user:', currentUserId)
        
        localStorage.removeItem('currentUserId')
        localStorage.removeItem('chatUserId')
        
        setCurrentUserId('')
        setChats([])
        setCurrentChat(null)
        setMessages({})
        setIsOnline(false)
        
        router.push('/')
    }

    const handleChatSelect = (chat) => {
        if (!chat || !chat.id) {
            console.log('⚠️ Invalid chat selected')
            return
        }
        
        console.log('📱 Chat selected:', chat.id)
        setCurrentChat(chat)
        
        if (currentUserId) {
            loadMessages(currentUserId, chat.id)
        }
        
        if (chat.hasUnread) {
            handleMarkAsRead(chat.id)
        }
    }

    const getTotalUnreadCount = () => {
        return chats.reduce((total, chat) => total + (chat.unreadCount || 0), 0)
    }

    if (!isClient) {
        return (
            <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
                <div className="text-white text-center">
                    <div className="text-4xl mb-4">💬</div>
                    <p className="text-lg">Loading Enhanced Chat...</p>
                </div>
            </div>
        )
    }

    if (isRegistering) {
        return (
            <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
                <div className="text-white text-center">
                    <div className="text-4xl mb-4 animate-pulse">💬</div>
                    <p className="text-lg">Registering user...</p>
                    <p className="text-sm opacity-75 mt-2">{currentUserId}</p>
                </div>
            </div>
        )
    }

    if (!currentUserId || currentUserId.trim() === '') {
        return (
            <div className="h-screen flex items-center justify-center bg-gradient-to-br from-red-500 to-pink-600">
                <div className="text-white text-center">
                    <div className="text-4xl mb-4">❌</div>
                    <p className="text-lg">Invalid user session</p>
                    <button 
                        onClick={() => router.push('/')}
                        className="mt-4 bg-white text-red-600 px-4 py-2 rounded-lg hover:bg-gray-100 transition"
                    >
                        Back to Home
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="h-screen flex flex-col">
            {/* FIXED: Enhanced header with better status */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-700 text-white p-4 flex justify-between items-center shadow-lg">
                <div className="flex items-center space-x-4">
                    <div>
                        <h1 className="text-xl font-bold flex items-center">
                            💬 Enhanced Chat
                            {getTotalUnreadCount() > 0 && (
                                <span className="ml-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs animate-bounce">
                                    {getTotalUnreadCount()} unread
                                </span>
                            )}
                        </h1>
                        <p className="text-sm opacity-90 flex items-center">
                            Hai, <span className="font-semibold mx-1">{currentUserId}</span>!
                            {isOnline ? (
                                <span className="text-green-300 ml-2 flex items-center">
                                    <span className="w-2 h-2 bg-green-400 rounded-full mr-1 animate-pulse"></span>
                                    Online
                                </span>
                            ) : (
                                <span className="text-red-300 ml-2 flex items-center">
                                    <span className="w-2 h-2 bg-red-400 rounded-full mr-1"></span>
                                    Offline
                                </span>
                            )}
                            {/* FIXED: Show registration status */}
                            {isRegistering && (
                                <span className="text-yellow-300 ml-2 flex items-center">
                                    <span className="w-2 h-2 bg-yellow-400 rounded-full mr-1 animate-pulse"></span>
                                    Connecting...
                                </span>
                            )}
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center space-x-3">
                    {lastActivity > 0 && (
                        <div className="text-xs opacity-75">
                            Last update: {new Date(lastActivity).toLocaleTimeString('id-ID')}
                        </div>
                    )}
                    <button
                        onClick={handleLogout}
                        className="bg-white bg-opacity-20 hover:bg-opacity-30 px-4 py-2 rounded-lg text-sm transition duration-200 backdrop-blur-sm font-semibold"
                        disabled={isRegistering}
                    >
                        Logout
                    </button>
                </div>
            </div>

            <div className="flex-1 flex">
                <ChatList
                    chats={chats}
                    currentChat={currentChat}
                    onChatSelect={handleChatSelect}
                    onAddChat={() => setShowAddModal(true)}
                />
                
                <ChatWindow
                    chat={currentChat}
                    messages={messages[currentChat?.id] || []}
                    onSendMessage={handleSendMessage}
                    onMarkAsRead={handleMarkAsRead}
                    currentUserId={currentUserId}
                />
            </div>

            <AddChatModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onAddChat={handleAddChat}
            />
        </div>
    )
}