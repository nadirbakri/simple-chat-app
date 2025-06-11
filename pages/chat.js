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
    const router = useRouter()

    const handleMarkAsRead = useCallback(async (chatWith) => {
        if (!currentUserId || !chatWith) return
        
        try {
        await chatAPI.markAsRead(currentUserId, chatWith)
        console.log(`👁️ Marked ${chatWith} as read`)
        
        setChats(prevChats => 
            prevChats.map(chat => 
            chat.id === chatWith 
                ? { ...chat, unreadCount: 0, hasUnread: false }
                : chat
            )
        )
        } catch (err) {
        console.error('❌ Failed to mark as read:', err)
        }
    }, [currentUserId])

    useEffect(() => {
        setIsClient(true)
        setLastActivity(Date.now())
    }, [])

    useEffect(() => {
        if (!isClient) return
        
        const userId = localStorage.getItem('chatUserId')
        if (!userId) {
        router.push('/')
        return
        }

        setCurrentUserId(userId)
        
        chatAPI.register(userId).then(result => {
        console.log('✅ User registered:', result)
        setIsOnline(true)
        }).catch(err => {
        console.error('❌ Registration failed:', err)
        setIsOnline(false)
        })
        
        loadChats(userId)
        
        const pollInterval = setInterval(() => {
            loadChats(currentUserId)
            
            if (currentChat) {
                loadMessages(currentUserId, currentChat.id)
            }

            setLastActivity(Date.now())
        }, 3000)
        
        return () => clearInterval(pollInterval)
    }, [isClient, currentChat])

    const loadChats = async (userId) => {
        try {
        const result = await chatAPI.getChats(userId)
        
        setChats(prevChats => {
            const newChats = result.chats || []
            
            if (prevChats.length === newChats.length && 
                JSON.stringify(prevChats.map(c => c.id)) === JSON.stringify(newChats.map(c => c.id))) {
            
            return prevChats.map(prevChat => {
                const newChat = newChats.find(nc => nc.id === prevChat.id)
                return newChat ? { ...prevChat, ...newChat } : prevChat
            })
            }
            
            return newChats
        })
        
        setIsOnline(true)
        } catch (err) {
        console.error('❌ Failed to load chats:', err)
        setIsOnline(false)
        }
    }

    const loadMessages = async (userId, chatWith) => {
        try {
        const result = await chatAPI.getMessages(userId, chatWith)
        const newMessages = result.messages || []
        
        setMessages(prev => {
            const existingMessages = prev[chatWith] || []
            if (JSON.stringify(existingMessages) !== JSON.stringify(newMessages)) {
            return {
                ...prev,
                [chatWith]: newMessages
            }
            }
            return prev
        })
        
        setIsOnline(true)
        } catch (err) {
        console.error('❌ Failed to load messages:', err)
        setIsOnline(false)
        }
    }

    const handleAddChat = async (searchId) => {
        console.log('🔍 Searching for user:', searchId)
        
        if (searchId === currentUserId) {
        throw new Error('Tidak bisa chat dengan diri sendiri!')
        }

        const existingChat = chats.find(chat => chat.id === searchId)
        if (existingChat) {
        throw new Error('Chat sudah ada!')
        }

        const result = await chatAPI.searchUser(currentUserId, searchId)
        
        if (result.exists) {
        console.log('✅ User found, chat relationship created on server!')
        
        const newChat = {
            id: searchId,
            name: searchId,
            lastMessage: '',
            lastMessageTime: null,
            unreadCount: 0,
            hasUnread: false
        }
        
        setChats(prev => [...prev, newChat])
        
        setTimeout(() => loadChats(currentUserId), 500)
        
        console.log('✅ Chat berhasil ditambahkan!')
        } else {
            throw new Error('User tidak ditemukan atau sedang offline!')
        }
    }

    const handleSendMessage = async (message) => {
        if (!currentChat || !currentUserId) return

        try {
        const result = await chatAPI.sendMessage(currentUserId, currentChat.id, message)
        console.log('📨 Message sent:', result)
        
        const messageData = result.message
        setMessages(prev => ({
            ...prev,
            [currentChat.id]: [...(prev[currentChat.id] || []), messageData]
        }))
        
        setChats(prev => prev.map(chat => 
            chat.id === currentChat.id 
            ? { ...chat, lastMessage: message, lastMessageTime: messageData.timestamp }
            : chat
        ))
        
        setTimeout(() => {
            loadMessages(currentUserId, currentChat.id)
            loadChats(currentUserId)
        }, 100)
        } catch (err) {
        console.error('❌ Failed to send message:', err)
        }
    }

    const handleLogout = () => {
        localStorage.removeItem('chatUserId')
        router.push('/')
    }

    const handleChatSelect = (chat) => {
        setCurrentChat(chat)
        loadMessages(currentUserId, chat.id)
        
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

    return (
        <div className="h-screen flex flex-col">
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
                    className="bg-white bg-opacity-20 hover:bg-opacity-30 px-4 py-2 rounded-lg text-sm transition duration-200 backdrop-blur-sm font-semibold text-gray-800"
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