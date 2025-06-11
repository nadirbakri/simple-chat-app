import { useState, useEffect, useRef } from 'react'
import { chatAPI } from '../lib/api'

export default function ChatWindow({ chat, messages, onSendMessage, onMarkAsRead, currentUserId }) {
  const [message, setMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [otherUserTyping, setOtherUserTyping] = useState(false)
  const [typingTimeout, setTypingTimeout] = useState(null)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [lastTypingCheck, setLastTypingCheck] = useState(0)
  const messagesEndRef = useRef(null)
  const typingCheckIntervalRef = useRef(null)
  const typingDebounceRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const checkTypingStatus = async () => {
    if (!chat || !currentUserId) return
    
    try {
      const now = Date.now()
      console.log(`⌨️ Checking typing status for ${chat.id} at ${new Date(now).toLocaleTimeString()}`)
      
      const data = await chatAPI.getTypingStatus(currentUserId, chat.id)
      
      console.log(`⌨️ Typing response:`, {
        isTyping: data.isTyping,
        typingUsers: data.typingUsers,
        debug: data.debug
      })
      
      if (data.isTyping && data.typingUsers?.length > 0) {
        console.log(`⌨️ ${data.typingUsers[0]} is typing to ${currentUserId}!`)
        setOtherUserTyping(true)
        setLastTypingCheck(now)
      } else {
        // Hanya set false jika sudah lebih dari 5 detik tidak ada typing
        const timeSinceLastCheck = now - lastTypingCheck
        if (timeSinceLastCheck > 5000) {
          setOtherUserTyping(false)
        }
      }
    } catch (error) {
      console.error('❌ Failed to check typing status:', error)
      setOtherUserTyping(false)
    }
  }

  useEffect(() => {
    if (!chat || !currentUserId) {
      setOtherUserTyping(false)
      if (typingCheckIntervalRef.current) {
        clearInterval(typingCheckIntervalRef.current)
      }
      return
    }
    
    console.log(`🔄 Starting typing poll for chat: ${chat.id}`)
    
    // Check immediately
    checkTypingStatus()
    
    // Then check every 1 second for better real-time experience
    typingCheckIntervalRef.current = setInterval(checkTypingStatus, 1000)
    
    return () => {
      console.log(`🛑 Stopping typing poll for chat: ${chat.id}`)
      if (typingCheckIntervalRef.current) {
        clearInterval(typingCheckIntervalRef.current)
      }
    }
  }, [chat?.id, currentUserId])

  const handleTyping = async (typing) => {
    if (!chat || !currentUserId) return
    
    try {
      console.log(`⌨️ Setting typing status: ${typing} for ${currentUserId} to ${chat.id}`)
      await chatAPI.setTyping(currentUserId, chat.id, typing)
    } catch (err) {
      console.error('❌ Failed to set typing status:', err)
    }
  }

  const handleInputChange = (e) => {
    const value = e.target.value
    setMessage(value)
    
    // Clear existing timeout
    if (typingDebounceRef.current) {
      clearTimeout(typingDebounceRef.current)
    }
    
    if (value.length > 0) {
      // Start typing if not already typing
      if (!isTyping) {
        console.log(`⌨️ User started typing`)
        setIsTyping(true)
        handleTyping(true)
      }
      
      // Set timeout to stop typing after 3 seconds
      typingDebounceRef.current = setTimeout(() => {
        console.log(`⌨️ User stopped typing (timeout)`)
        setIsTyping(false)
        handleTyping(false)
      }, 3000)
    } else {
      // Stop typing immediately if input is empty
      console.log(`⌨️ User stopped typing (empty input)`)
      setIsTyping(false)
      handleTyping(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (message.trim() && chat && !sendingMessage) {
      console.log(`📨 Sending message, stopping typing indicator`)
      
      setSendingMessage(true)
      
      // Stop typing indicator immediately
      setIsTyping(false)
      handleTyping(false)
      
      // Clear timeouts
      if (typingDebounceRef.current) {
        clearTimeout(typingDebounceRef.current)
      }
      
      try {
        await onSendMessage(message.trim())
        setMessage('')
      } catch (error) {
        console.error('❌ Failed to send message:', error)
        alert('Failed to send message. Please try again.')
      } finally {
        setSendingMessage(false)
      }
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingDebounceRef.current) {
        clearTimeout(typingDebounceRef.current)
      }
      if (typingCheckIntervalRef.current) {
        clearInterval(typingCheckIntervalRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (chat && messages.length > 0) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage && lastMessage.from !== currentUserId) {
        onMarkAsRead(chat.id)
      }
    }
  }, [chat, messages, onMarkAsRead, currentUserId])

  if (!chat) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center text-gray-500">
          <div className="text-6xl mb-4">💬</div>
          <p className="text-lg font-medium">Pilih chat untuk memulai percakapan</p>
          <p className="text-sm mt-2">Real-time dengan typing indicators</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="p-4 bg-white border-b border-gray-300 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold mr-3">
              {chat.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">{chat.name}</h3>
              {otherUserTyping ? (
                <p className="text-sm text-blue-600 animate-pulse flex items-center">
                  <span className="mr-1">⌨️</span>
                  <span>sedang mengetik...</span>
                  <div className="flex space-x-1 ml-2">
                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"></div>
                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                </p>
              ) : (
                <p className="text-sm text-green-500">● Online</p>
              )}
            </div>
          </div>
          <div className="text-xs text-gray-500">
            {messages.length} pesan
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-gray-50 to-white">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <div className="text-4xl mb-2">👋</div>
            <p>Belum ada pesan. Mulai percakapan!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.from === currentUserId
            
            return (
              <div
                key={msg.id}
                className={`mb-4 flex ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`
                    max-w-xs lg:max-w-md px-4 py-2 rounded-lg transition-all duration-300
                    ${isOwn
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                      : 'bg-white text-gray-800 border border-gray-200 shadow-sm'
                    }
                  `}
                >
                  <p className="text-sm break-words">{msg.message}</p>
                  <div className="flex justify-between items-center mt-1">
                    <p className="text-xs opacity-70">
                      {new Date(msg.timestamp).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                    {isOwn && (
                      <span className="text-xs opacity-70">✓✓</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}

        {otherUserTyping && (
          <div className="mb-4 flex justify-start">
            <div className="bg-gray-200 text-gray-600 px-4 py-2 rounded-lg max-w-xs animate-pulse">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">{chat.name}</span>
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 bg-white border-t border-gray-300">
        {isTyping && (
          <div className="text-xs text-blue-600 mb-2 animate-pulse flex items-center">
            <span className="mr-2">⌨️</span>
            <span>Mengetik...</span>
            <div className="flex space-x-1 ml-2">
              <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"></div>
              <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
              <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
            </div>
          </div>
        )}
        <div className="flex space-x-2">
          <input
            type="text"
            value={message}
            onChange={handleInputChange}
            placeholder="Ketik pesan..."
            disabled={sendingMessage}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white transition-all duration-200 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!message.trim() || sendingMessage}
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-400 text-white px-6 py-2 rounded-lg transition duration-200 disabled:cursor-not-allowed"
          >
            {sendingMessage ? (
              <span className="flex items-center">
                <span className="animate-spin mr-2">⏳</span>
                Kirim
              </span>
            ) : (
              'Kirim'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}