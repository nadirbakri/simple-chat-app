import { useState, useEffect, useCallback, useRef } from 'react'
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
    const [connectionRetries, setConnectionRetries] = useState(0)
    const [isMobile, setIsMobile] = useState(false)
    const [showChatList, setShowChatList] = useState(true)
    const router = useRouter()
    const pollIntervalRef = useRef(null)
    const messagesPollRef = useRef(null)
    const maxRetries = 3

    useEffect(() => {
        const checkMobile = () => {
            const isMobileScreen = window.innerWidth < 768
            setIsMobile(isMobileScreen)
            
            if (isMobileScreen && !currentChat) {
                setShowChatList(true)
            }
        }
        
        checkMobile()
        window.addEventListener('resize', checkMobile)
        
        return () => window.removeEventListener('resize', checkMobile)
    }, [currentChat])

    useEffect(() => {
        if (isMobile) {
            if (currentChat) {
                setShowChatList(false)
            } else {
                setShowChatList(true)
            }
        } else {
            setShowChatList(true)
        }
    }, [isMobile, currentChat])

    const handleMarkAsRead = useCallback(async (chatWith) => {
        if (!currentUserId || !chatWith) return
        
        try {
            await chatAPI.markAsRead(currentUserId, chatWith)
            
            setChats(prevChats => 
                prevChats.map(chat => 
                    chat.id === chatWith 
                        ? { ...chat, unreadCount: 0, hasUnread: false }
                        : chat
                )
            )
        } catch (err) {
            
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
        
        const registerUser = async () => {
            try {
                await chatAPI.register(userId)
                setIsOnline(true)
                setConnectionRetries(0)
            } catch (err) {
                if (connectionRetries < maxRetries) {
                    setConnectionRetries(prev => prev + 1)
                    setTimeout(registerUser, 2000)
                } else {
                    setIsOnline(false)
                }
            }
        }
        
        registerUser()
        loadChats(userId)
    }, [isClient, router])

    useEffect(() => {
        if (!currentUserId) return

        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current)
        }

        pollIntervalRef.current = setInterval(() => {
            loadChats(currentUserId)
            setLastActivity(Date.now())
        }, 3000)
        
        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current)
            }
        }
    }, [currentUserId])

    useEffect(() => {
        if (!currentUserId || !currentChat) {
            if (messagesPollRef.current) {
                clearInterval(messagesPollRef.current)
            }
            return
        }

        loadMessages(currentUserId, currentChat.id)

        messagesPollRef.current = setInterval(() => {
            loadMessages(currentUserId, currentChat.id)
        }, 1000)
        
        return () => {
            if (messagesPollRef.current) {
                clearInterval(messagesPollRef.current)
            }
        }
    }, [currentUserId, currentChat?.id])

    const loadChats = async (userId) => {
        if (!userId) return
        
        try {
            const result = await chatAPI.getChats(userId)
            
            setChats(prevChats => {
                const newChats = result.chats || []
                
                if (prevChats.length === newChats.length && 
                    JSON.stringify(prevChats.map(c => ({ id: c.id, unreadCount: c.unreadCount }))) === 
                    JSON.stringify(newChats.map(c => ({ id: c.id, unreadCount: c.unreadCount })))) {
                    return prevChats
                }
                
                return newChats
            })
            
            setIsOnline(true)
            setConnectionRetries(0)
        } catch (err) {
            if (connectionRetries >= maxRetries) {
                setIsOnline(false)
            } else {
                setConnectionRetries(prev => prev + 1)
            }
        }
    }

    const loadMessages = async (userId, chatWith) => {
        if (!userId || !chatWith) return
        
        try {
            const result = await chatAPI.getMessages(userId, chatWith)
            const newMessages = result.messages || []
            
            setMessages(prev => {
                const existingMessages = prev[chatWith] || []
                
                if (JSON.stringify(existingMessages.map(m => m.id)) !== JSON.stringify(newMessages.map(m => m.id))) {
                    return {
                        ...prev,
                        [chatWith]: newMessages
                    }
                }
                return prev
            })
            
            setIsOnline(true)
            setConnectionRetries(0)
        } catch (err) {
            
        }
    }

    const handleAddChat = async (searchId) => {
        if (searchId === currentUserId) {
            throw new Error('Tidak bisa chat dengan diri sendiri!')
        }

        const existingChat = chats.find(chat => chat.id === searchId)
        if (existingChat) {
            throw new Error('Chat sudah ada!')
        }

        const result = await chatAPI.searchUser(currentUserId, searchId)
        
        if (result.exists) {
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
        } else {
            throw new Error('User tidak ditemukan atau sedang offline!')
        }
    }

    const handleSendMessage = async (message) => {
        if (!currentChat || !currentUserId) return

        try {
            const result = await chatAPI.sendMessage(currentUserId, currentChat.id, message)
            
            const messageData = result.message
            setChats(prev => prev.map(chat => 
                chat.id === currentChat.id 
                    ? { ...chat, lastMessage: message, lastMessageTime: messageData.timestamp }
                    : chat
            ))
            
            setTimeout(() => {
                loadMessages(currentUserId, currentChat.id)
            }, 200)
        } catch (err) {
            throw err
        }
    }

    const handleLogout = () => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current)
        }
        if (messagesPollRef.current) {
            clearInterval(messagesPollRef.current)
        }
        localStorage.removeItem('chatUserId')
        router.push('/')
    }

    const handleChatSelect = (chat) => {
        setCurrentChat(chat)
        
        if (chat.hasUnread) {
            handleMarkAsRead(chat.id)
        }
    }

    const handleBackToList = () => {
        if (isMobile) {
            setCurrentChat(null)
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
                    <p className="text-lg">Loading Simple Chat...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="h-screen flex flex-col bg-gray-100">
            <div className="bg-gradient-to-r from-blue-600 to-purple-700 text-white shadow-lg flex-shrink-0">
                <div className="p-3 md:p-4 flex justify-between items-center">
                    <div className="flex items-center space-x-2 md:space-x-4 min-w-0 flex-1">
                        <div className="min-w-0 flex-1">
                            <h1 className="text-base md:text-xl font-bold flex items-center">
                                💬 Simple Chat
                                {getTotalUnreadCount() > 0 && (
                                    <span className="ml-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs animate-pulse">
                                        {getTotalUnreadCount()} unread
                                    </span>
                                )}
                            </h1>
                            <p className="text-xs md:text-sm opacity-90 flex items-center">
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
                    
                    <div className="flex items-center space-x-2 md:space-x-3 flex-shrink-0">
                        {lastActivity > 0 && (
                            <div className="text-xs opacity-75 hidden lg:block">
                                Last: {new Date(lastActivity).toLocaleTimeString('id-ID')}
                            </div>
                        )}
                        <button
                            onClick={handleLogout}
                            className="bg-white/20 hover:bg-white/30 text-white px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm transition duration-200 backdrop-blur-sm border border-white/20 font-medium shadow-sm"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden min-h-0">
                <div className={`${showChatList ? 'flex' : 'hidden md:flex'} w-full md:w-80 flex-col bg-white border-r border-gray-300 h-full`}>
                    <ChatList
                        chats={chats}
                        currentChat={currentChat}
                        onChatSelect={handleChatSelect}
                        onAddChat={() => setShowAddModal(true)}
                        isHidden={false}
                    />
                </div>
                
                {(currentChat || !isMobile) && (
                    <div className="flex-1 flex">
                        <ChatWindow
                            chat={currentChat}
                            messages={messages[currentChat?.id] || []}
                            onSendMessage={handleSendMessage}
                            onMarkAsRead={handleMarkAsRead}
                            currentUserId={currentUserId}
                            onBackToList={handleBackToList}
                        />
                    </div>
                )}
            </div>

            <AddChatModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onAddChat={handleAddChat}
            />
        </div>
    )
}